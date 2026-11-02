package com.rms.resident.request;

import com.rms.resident.catalog.ServiceItem;
import com.rms.resident.catalog.ServiceItemRepository;
import com.rms.resident.common.enums.NotificationType;
import com.rms.resident.common.enums.RequestStatus;
import com.rms.resident.common.enums.Role;
import com.rms.resident.common.error.ApiException;
import com.rms.resident.common.error.ErrorCode;
import com.rms.resident.common.paging.LikeEscaper;
import com.rms.resident.common.paging.PageResponse;
import com.rms.resident.common.paging.SortValidator;
import com.rms.resident.notification.ResidentNotification;
import com.rms.resident.notification.ResidentNotificationRepository;
import com.rms.resident.user.AuthenticatedUser;
import com.rms.resident.user.UserAccount;
import com.rms.resident.user.UserAccountRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import static com.rms.resident.request.RequestDtos.*;

@Service
public class RequestService {
    private final ServiceRequestRepository requests;
    private final RequestStatusHistoryRepository history;
    private final ResidentNotificationRepository notifications;
    private final ServiceItemRepository services;
    private final UserAccountRepository users;
    private final Clock clock;
    public RequestService(ServiceRequestRepository requests, RequestStatusHistoryRepository history,
                          ResidentNotificationRepository notifications, ServiceItemRepository services,
                          UserAccountRepository users, Clock clock) {
        this.requests=requests; this.history=history; this.notifications=notifications; this.services=services;
        this.users=users; this.clock=clock;
    }
    @Transactional
    public Response create(AuthenticatedUser actor, Create body) {
        UserAccount resident = user(actor.id());
        ServiceItem service = services.findById(body.serviceId()).filter(ServiceItem::isActive)
                .orElseThrow(() -> notFound("Service not found"));
        LocalDate today = RequestDates.requestDate(clock);
        if (!RequestDates.expectedDateIsValid(today, body.expectedCompletionDate()))
            throw new ApiException(ErrorCode.VALIDATION_ERROR,"expectedCompletionDate must be on or after requestDate",
                    List.of(new com.rms.resident.common.error.ApiErrorDetail("expectedCompletionDate","Must be on or after requestDate")));
        ServiceRequest saved = requests.saveAndFlush(ServiceRequest.create(resident.getId(),resident.getFlatNumber(),service.getId(),
                body.description().trim(),today,body.expectedCompletionDate(),clock.instant()));
        history.save(RequestStatusHistory.create(saved.getId(),null,RequestStatus.PENDING,resident.getId(),null,clock.instant()));
        return response(saved,resident,service);
    }
    @Transactional(readOnly=true)
    public PageResponse<Response> list(AuthenticatedUser actor, RequestStatus status, Boolean overdue, String q,
                                       Integer page, Integer size, String sort) {
        var sortSpec=SortValidator.parse(sort,"createdAt,desc",Set.of("createdAt","requestDate","expectedCompletionDate","status"));
        int pageSize=SortValidator.clampSize(size);
        Specification<ServiceRequest> spec=(root,query,cb)->cb.conjunction();
        if(actor.role()==Role.USER) spec=spec.and((root,query,cb)->cb.equal(root.get("residentId"),actor.id()));
        if(status!=null) spec=spec.and((root,query,cb)->cb.equal(root.get("status"),status));
        if(overdue!=null) {
            Specification<ServiceRequest> overdueSpec=RequestSpecifications.overdue(OverdueRule.today(clock));
            spec=spec.and(overdue ? overdueSpec : Specification.not(overdueSpec));
        }
        if(actor.role()!=Role.USER && q!=null && !q.isBlank()) {
            LikeEscaper.LikePattern pattern=LikeEscaper.containsPattern(q);
            String escaped=pattern.value(); char escape=pattern.escapeCharacter();
            spec=spec.and((root,query,cb)->{
                var resident=query.subquery(Long.class); var u=resident.from(UserAccount.class);
                resident.select(u.get("id")).where(cb.and(cb.equal(u.get("id"),root.get("residentId")),
                        cb.or(cb.like(cb.lower(u.get("fullName")),escaped,escape),cb.like(cb.lower(u.get("flatNumber")),escaped,escape))));
                return cb.exists(resident);
            });
        }
        Page<ServiceRequest> result=requests.findAll(spec,PageRequest.of(page==null?0:Math.max(0,page),pageSize,sortSpec.toSort()));
        return new PageResponse<>(mapResponses(result.getContent()),result.getNumber(),result.getSize(),result.getTotalElements(),result.getTotalPages());
    }
    @Transactional(readOnly=true)
    public Response get(AuthenticatedUser actor, Long id) { return response(findVisible(actor,id)); }
    @Transactional(readOnly=true)
    public List<History> history(AuthenticatedUser actor,Long id,String sort) {
        var parsed=SortValidator.parse(sort,"createdAt,asc",Set.of("createdAt"));
        if(parsed.direction()!=org.springframework.data.domain.Sort.Direction.ASC)
            throw new ApiException(ErrorCode.VALIDATION_ERROR,"History sort must be createdAt,asc");
        ServiceRequest request=findVisible(actor,id);
        var rows=history.findByRequestIdOrderByCreatedAtAscIdAsc(request.getId());
        var people=users.findAllById(rows.stream().map(RequestStatusHistory::getChangedBy).collect(java.util.stream.Collectors.toSet()))
                .stream().collect(java.util.stream.Collectors.toMap(UserAccount::getId,u->u));
        return rows.stream().map(item->{var person=people.get(item.getChangedBy());
            return new History(item.getFromStatus(),item.getToStatus(),new Person(person.getId(),person.getFullName()),item.getRemarks(),item.getCreatedAt());}).toList();
    }
    @Transactional
    public Response update(AuthenticatedUser actor,Long id,Update body) {
        ServiceRequest request=requests.findById(id).orElseThrow(()->notFound("Request not found"));
        String remarks=body.adminRemarks()==null?null:body.adminRemarks().trim();
        if(body.status()==null) {
            if(request.getStatus()==RequestStatus.COMPLETED || request.getStatus()==RequestStatus.REJECTED)
                throw new ApiException(ErrorCode.INVALID_STATUS_TRANSITION,"Request is closed");
            if(remarks!=null) request.updateRemarks(remarks,clock.instant());
            return response(request);
        }
        RequestStatus target=body.status();
        if(!RequestTransitionPolicy.allows(request.getStatus(),target))
            throw new ApiException(ErrorCode.INVALID_STATUS_TRANSITION,"Invalid transition from "+request.getStatus()+" to "+target);
        if(target==RequestStatus.REJECTED && (remarks==null || remarks.isBlank()))
            throw new ApiException(ErrorCode.VALIDATION_ERROR,"adminRemarks is required when status is REJECTED",
                    List.of(new com.rms.resident.common.error.ApiErrorDetail("adminRemarks","Must be non-blank when status is REJECTED")));
        RequestStatus old=request.getStatus(); request.changeStatus(target,remarks,clock.instant());
        request=requests.saveAndFlush(request);
        history.save(RequestStatusHistory.create(id,old,target,actor.id(),remarks,clock.instant()));
        ServiceItem service=services.findById(request.getServiceId()).orElseThrow(()->notFound("Service not found"));
        String message="Your request #"+id+" for "+service.getName()+" is now "+target+"."+(remarks==null?"":" Note: "+remarks);
        if(message.length()>500) message=message.substring(0,500);
        notifications.save(ResidentNotification.create(request.getResidentId(),id,NotificationType.REQUEST_STATUS_CHANGED,message,clock.instant()));
        return response(request);
    }
    private ServiceRequest findVisible(AuthenticatedUser actor,Long id) {
        ServiceRequest item=requests.findById(id).orElseThrow(()->notFound("Request not found"));
        if(actor.role()==Role.USER && !Objects.equals(actor.id(),item.getResidentId())) throw notFound("Request not found");
        return item;
    }
    private Response response(ServiceRequest item) { return response(item,user(item.getResidentId()),services.findById(item.getServiceId()).orElseThrow()); }
    private List<Response> mapResponses(List<ServiceRequest> rows) {
        var userMap=users.findAllById(rows.stream().map(ServiceRequest::getResidentId).collect(java.util.stream.Collectors.toSet()))
                .stream().collect(java.util.stream.Collectors.toMap(UserAccount::getId,u->u));
        var serviceMap=services.findAllById(rows.stream().map(ServiceRequest::getServiceId).collect(java.util.stream.Collectors.toSet()))
                .stream().collect(java.util.stream.Collectors.toMap(ServiceItem::getId,s->s));
        return rows.stream().map(row->response(row,userMap.get(row.getResidentId()),serviceMap.get(row.getServiceId()))).toList();
    }
    private Response response(ServiceRequest item,UserAccount resident,ServiceItem service) {
        return new Response(item.getId(),new Person(resident.getId(),resident.getFullName()),item.getFlatNumber(),new RequestDtos.Service(service.getId(),service.getName()),
                item.getDescription(),item.getRequestDate(),item.getExpectedCompletionDate(),item.getStatus(),item.getAdminRemarks(),item.getVersion(),
                OverdueRule.today(clock).matches(item.getExpectedCompletionDate(),item.getStatus()),item.getCreatedAt(),item.getUpdatedAt());
    }
    private UserAccount user(Long id) { return users.findById(id).orElseThrow(()->notFound("User not found")); }
    private static ApiException notFound(String message) { return new ApiException(ErrorCode.NOT_FOUND,message); }
}
