package com.rms.resident.catalog;

import com.rms.resident.common.error.ApiException;
import com.rms.resident.common.error.ErrorCode;
import com.rms.resident.common.paging.LikeEscaper;
import com.rms.resident.common.paging.PageResponse;
import com.rms.resident.common.paging.SortValidator;
import com.rms.resident.user.AuthenticatedUser;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class ServiceCatalogService {
    private static final Set<String> SORT_FIELDS = Set.of("name", "createdAt");
    private final ServiceItemRepository services;
    private final Clock clock;

    public ServiceCatalogService(ServiceItemRepository services, Clock clock) { this.services = services; this.clock = clock; }

    @Transactional(readOnly = true)
    public PageResponse<ServiceResponse> list(AuthenticatedUser actor, String activeValue, String q,
                                               int page, Integer size, String sort) {
        Boolean active = ServiceVisibilityPolicy.activeFilter(actor.role(), activeValue);
        Specification<ServiceItem> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (active != null) predicates.add(cb.equal(root.get("active"), active));
            LikeEscaper.LikePattern pattern = LikeEscaper.containsPattern(q);
            if (pattern != null) {
                predicates.add(cb.like(cb.lower(root.get("name")), pattern.value(), pattern.escapeCharacter()));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        var parsed = SortValidator.parse(sort, "name,asc", SORT_FIELDS);
        Page<ServiceItem> result = services.findAll(spec,
                PageRequest.of(Math.max(0, page), SortValidator.clampSize(size), parsed.toSort()));
        return PageResponse.from(result.map(ServiceResponse::from));
    }

    @Transactional(readOnly = true)
    public ServiceResponse get(AuthenticatedUser actor, Long id) {
        ServiceItem item = find(id);
        if (!ServiceVisibilityPolicy.mayView(actor.role(), item.isActive())) notFound();
        return ServiceResponse.from(item);
    }

    @Transactional
    public ServiceResponse create(AuthenticatedUser actor, ServiceWriteRequest request) {
        try {
            ServiceItem saved = services.saveAndFlush(ServiceItem.create(request.name(), request.description(), actor.id(), clock.instant()));
            return ServiceResponse.from(saved);
        } catch (DataIntegrityViolationException ex) { throw duplicate(); }
    }

    @Transactional
    public ServiceResponse update(Long id, ServiceWriteRequest request) {
        ServiceItem item = find(id);
        item.update(request.name(), request.description(), clock.instant());
        try { return ServiceResponse.from(services.saveAndFlush(item)); }
        catch (DataIntegrityViolationException ex) { throw duplicate(); }
    }

    @Transactional
    public ServiceResponse activate(Long id, boolean active) {
        ServiceItem item = find(id); item.setActive(active, clock.instant());
        return ServiceResponse.from(services.save(item));
    }

    private ServiceItem find(Long id) {
        return services.findById(id).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Service not found"));
    }
    private static void notFound() { throw new ApiException(ErrorCode.NOT_FOUND, "Service not found"); }
    private static ApiException duplicate() { return new ApiException(ErrorCode.DUPLICATE_RESOURCE, "A service with this name already exists"); }
}
