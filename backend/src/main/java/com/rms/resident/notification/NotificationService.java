package com.rms.resident.notification;

import com.rms.resident.common.error.ApiException;
import com.rms.resident.common.error.ErrorCode;
import com.rms.resident.common.paging.PageResponse;
import com.rms.resident.common.paging.SortValidator;
import com.rms.resident.user.AuthenticatedUser;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.Set;
import static com.rms.resident.notification.NotificationDtos.*;

@Service
public class NotificationService {
    private final ResidentNotificationRepository repository; private final Clock clock;
    public NotificationService(ResidentNotificationRepository repository,Clock clock){this.repository=repository;this.clock=clock;}
    @Transactional(readOnly=true)
    public PageResponse<Response> list(AuthenticatedUser actor,Boolean unreadOnly,Integer page,Integer size,String sort){
        var s=SortValidator.parse(sort,"createdAt,desc",Set.of("createdAt"));
        Specification<ResidentNotification> spec=(root,q,cb)->cb.equal(root.get("recipientId"),actor.id());
        if(Boolean.TRUE.equals(unreadOnly)) spec=spec.and((root,q,cb)->cb.isFalse(root.get("read")));
        var result=repository.findAll(spec,PageRequest.of(page==null?0:Math.max(page,0),SortValidator.clampSize(size),s.toSort()));
        return new PageResponse<>(result.getContent().stream().map(this::response).toList(),result.getNumber(),result.getSize(),result.getTotalElements(),result.getTotalPages());
    }
    @Transactional(readOnly=true) public UnreadCount unreadCount(AuthenticatedUser actor){return new UnreadCount(repository.countByRecipientIdAndReadFalse(actor.id()));}
    @Transactional public ReadResponse read(AuthenticatedUser actor,Long id){
        var n=repository.findById(id).filter(item->item.getRecipientId().equals(actor.id())).orElseThrow(()->new ApiException(ErrorCode.NOT_FOUND,"Notification not found"));
        n.markRead(clock.instant()); return new ReadResponse(n.getId(),n.isRead(),n.getReadAt());
    }
    @Transactional public void readAll(AuthenticatedUser actor){repository.markAllRead(actor.id(),clock.instant());}
    private Response response(ResidentNotification n){return new Response(n.getId(),n.getRequestId(),n.getType().name(),n.getMessage(),n.isRead(),n.getCreatedAt(),n.getReadAt());}
}
