package com.rms.resident.contact;

import com.rms.resident.common.error.ApiException;
import com.rms.resident.common.error.ErrorCode;
import com.rms.resident.common.paging.PageResponse;
import com.rms.resident.common.paging.SortValidator;
import com.rms.resident.common.ratelimit.RateLimiter;
import com.rms.resident.user.AuthenticatedUser;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.Set;

@Service
public class ContactQueryService {
    private final ContactQueryRepository queries;
    private final RateLimiter contactRateLimiter;
    private final Clock clock;
    public ContactQueryService(ContactQueryRepository queries, @Qualifier("contactRateLimiter") RateLimiter contactRateLimiter, Clock clock) {
        this.queries=queries; this.contactRateLimiter=contactRateLimiter; this.clock=clock;
    }
    @Transactional
    public ContactDtos.Created submit(ContactDtos.CreateRequest body, AuthenticatedUser actor, String clientIp) {
        if(actor==null) {
            RateLimiter.Decision decision=contactRateLimiter.tryAcquire("contact:"+clientIp);
            if(!decision.allowed()) throw new ApiException(ErrorCode.TOO_MANY_REQUESTS,"Contact submission rate limit exceeded",decision.retryAfterSeconds());
        }
        var saved=queries.saveAndFlush(ContactQuery.create(actor==null?null:actor.id(),body.name(),body.email(),
                body.subject(),body.message(),clock.instant()));
        return new ContactDtos.Created(saved.getId(),saved.getCreatedAt());
    }
    @Transactional(readOnly=true)
    public PageResponse<ContactDtos.Response> list(Integer page,Integer size,String sort) {
        var parsed=SortValidator.parse(sort,"createdAt,desc",Set.of("createdAt"));
        var result=queries.findAll(PageRequest.of(page==null?0:Math.max(0,page),SortValidator.clampSize(size),parsed.toSort()));
        return PageResponse.from(result.map(this::response));
    }
    @Transactional(readOnly=true)
    public ContactDtos.Response get(Long id) {
        return queries.findById(id).map(this::response).orElseThrow(()->new ApiException(ErrorCode.NOT_FOUND,"Contact query not found"));
    }
    private ContactDtos.Response response(ContactQuery query) {
        return new ContactDtos.Response(query.getId(),query.getSubmittedBy(),query.getName(),query.getEmail(),query.getSubject(),query.getMessage(),query.getCreatedAt());
    }
}
