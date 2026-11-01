package com.rms.resident.user;

import com.rms.resident.auth.UserResponse;
import com.rms.resident.common.enums.Role;
import com.rms.resident.common.error.ApiException;
import com.rms.resident.common.error.ErrorCode;
import com.rms.resident.common.paging.LikeEscaper;
import com.rms.resident.common.paging.PageResponse;
import com.rms.resident.common.paging.SortValidator;
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
import java.util.Locale;
import java.util.Set;

@Service
public class UserAdministrationService {
    private static final Set<String> SORT_FIELDS = Set.of("createdAt", "fullName", "email", "role");
    private final UserAccountRepository users;
    private final UserAccessPolicy policy;
    private final org.springframework.security.crypto.password.PasswordEncoder encoder;
    private final Clock clock;

    public UserAdministrationService(UserAccountRepository users, UserAccessPolicy policy,
                                     org.springframework.security.crypto.password.PasswordEncoder encoder, Clock clock) {
        this.users = users; this.policy = policy; this.encoder = encoder; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserListItemResponse> list(AuthenticatedUser actor, Role role, Boolean active, String q,
                                                    int page, Integer size, String sort) {
        if (actor.role() == Role.ADMIN && role != null && role != Role.USER) forbidden();
        Specification<UserAccount> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (actor.role() == Role.ADMIN) predicates.add(cb.equal(root.get("role"), Role.USER));
            else if (role != null) predicates.add(cb.equal(root.get("role"), role));
            if (active != null) predicates.add(cb.equal(root.get("active"), active));
            String pattern = LikeEscaper.containsPattern(q);
            if (pattern != null) {
                predicates.add(cb.or(cb.like(cb.lower(root.get("fullName")), pattern, '!'),
                        cb.like(cb.lower(root.get("email")), pattern, '!')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        var sortSpec = SortValidator.parse(sort, "createdAt,desc", SORT_FIELDS);
        Page<UserAccount> result = users.findAll(spec, PageRequest.of(Math.max(0, page), SortValidator.clampSize(size), sortSpec.toSort()));
        return PageResponse.from(result.map(UserListItemResponse::from));
    }

    @Transactional
    public UserResponse create(AuthenticatedUser actor, UserCreateRequest request) {
        if (!policy.may(actor.role(), request.role(), UserAccessPolicy.Operation.CREATE)) forbidden();
        validateFlat(request.role(), request.flatNumber());
        UserAccount user = UserAccount.create(request.fullName(), normalizeEmail(request.email()),
                encoder.encode(request.password()), request.role(), request.flatNumber(), clock.instant());
        try { return UserResponse.from(users.saveAndFlush(user)); }
        catch (DataIntegrityViolationException ex) { throw duplicateEmail(); }
    }

    @Transactional(readOnly = true)
    public UserAdminResponse get(AuthenticatedUser actor, Long id) {
        UserAccount target = find(id);
        requirePolicy(actor, target, UserAccessPolicy.Operation.VIEW);
        return UserAdminResponse.from(target);
    }

    @Transactional
    public UserAdminResponse update(AuthenticatedUser actor, Long id, UserUpdateRequest request) {
        UserAccount target = find(id);
        requirePolicy(actor, target, UserAccessPolicy.Operation.EDIT);
        validateFlat(target.getRole(), request.flatNumber());
        target.updateProfile(request.fullName(), normalizeEmail(request.email()), request.flatNumber(), clock.instant());
        try { return UserAdminResponse.from(users.saveAndFlush(target)); }
        catch (DataIntegrityViolationException ex) { throw duplicateEmail(); }
    }

    @Transactional
    public UserResponse activate(AuthenticatedUser actor, Long id, boolean active) {
        UserAccount target = find(id);
        if (!active && target.getId().equals(actor.id()))
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "You cannot deactivate your own account");
        requirePolicy(actor, target, UserAccessPolicy.Operation.ACTIVATE);
        target.setActive(active, clock.instant());
        return UserResponse.from(users.save(target));
    }

    private UserAccount find(Long id) {
        return users.findById(id).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "User not found"));
    }
    private void requirePolicy(AuthenticatedUser actor, UserAccount target, UserAccessPolicy.Operation operation) {
        if (!policy.may(actor.role(), target.getRole(), operation)) forbidden();
    }
    private static void validateFlat(Role role, String flat) {
        if (role == Role.USER ? flat == null || flat.isBlank() : flat != null)
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "flatNumber is required for USER and must be absent for ADMIN");
    }
    private static String normalizeEmail(String email) { return email.trim().toLowerCase(Locale.ROOT); }
    private static ApiException duplicateEmail() { return new ApiException(ErrorCode.DUPLICATE_RESOURCE, "An account with this email already exists"); }
    private static void forbidden() { throw new ApiException(ErrorCode.FORBIDDEN, "You do not have permission to access this resource"); }
}
