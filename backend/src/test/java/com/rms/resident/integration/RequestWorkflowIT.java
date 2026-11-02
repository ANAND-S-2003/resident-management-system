package com.rms.resident.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rms.resident.auth.JwtService;
import com.rms.resident.catalog.ServiceItem;
import com.rms.resident.catalog.ServiceItemRepository;
import com.rms.resident.common.enums.RequestStatus;
import com.rms.resident.common.enums.Role;
import com.rms.resident.notification.ResidentNotificationRepository;
import com.rms.resident.request.RequestStatusHistoryRepository;
import com.rms.resident.request.ServiceRequestRepository;
import com.rms.resident.user.UserAccount;
import com.rms.resident.user.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.ResultHandler;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "logging.level.org.hibernate.SQL=DEBUG",
        "logging.level.org.hibernate.orm.jdbc.bind=TRACE"
})
class RequestWorkflowIT {
    private static final AtomicInteger FLAT_SEQUENCE = new AtomicInteger();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) { SharedMySqlContainer.registerProperties(registry); }
    @Autowired MockMvc rawMvc; private final Map<String,Role> tokenRoles=new ConcurrentHashMap<>();
    private final ContextualMvc mvc=new ContextualMvc();
    @Autowired ObjectMapper mapper; @Autowired UserAccountRepository users;
    @Autowired ServiceItemRepository services; @Autowired ServiceRequestRepository requests;
    @Autowired RequestStatusHistoryRepository history; @Autowired ResidentNotificationRepository notifications;
    @Autowired PasswordEncoder encoder; @Autowired JwtService jwt; @Autowired Clock clock;

    @Test void creationSnapshotsResidentAndWritesInitialHistory() throws Exception {
        var resident=user(Role.USER); var admin=user(Role.ADMIN); var service=service(admin);
        var result=mvc.perform(post("/api/v1/requests").header("Authorization",bearer(resident)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"serviceId\":"+service.getId()+",\"description\":\"Leaking kitchen tap\",\"expectedCompletionDate\":\""+LocalDate.now(clock).plusDays(1)+"\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.requestDate").value(LocalDate.now(clock).toString()))
                .andExpect(jsonPath("$.flatNumber").value(resident.getFlatNumber())).andReturn();
        long id=mapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
        assertThat(history.findByRequestIdOrderByCreatedAtAscIdAsc(id)).hasSize(1);
        String snapshot=resident.getFlatNumber();
        resident.updateProfile(resident.getFullName(),resident.getEmail(),"changed-flat",clock.instant()); users.saveAndFlush(resident);
        mvc.perform(get("/api/v1/requests/{id}",id).header("Authorization",bearer(resident)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.flatNumber").value(snapshot));
    }

    @Test void statusWorkflowWritesHistoryAndOneNotificationPerTransitionAndSupportsRead() throws Exception {
        var resident=user(Role.USER); var admin=user(Role.ADMIN); var service=service(admin);
        var request=request(resident,service,RequestStatus.PENDING,LocalDate.now(clock).plusDays(1));
        String path="/api/v1/requests/"+request.getId();
        mvc.perform(patch(path).header("Authorization",bearer(admin)).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("IN_PROGRESS"));
        mvc.perform(patch(path).header("Authorization",bearer(admin)).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isOk());
        assertThat(history.findByRequestIdOrderByCreatedAtAscIdAsc(request.getId())).hasSize(3);
        assertThat(notifications.findAll()).filteredOn(n->n.getRequestId().equals(request.getId())).hasSize(2);
        mvc.perform(get("/api/v1/requests/{id}/history",request.getId()).header("Authorization",bearer(resident)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].fromStatus").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$[0].toStatus").value("PENDING"));
        mvc.perform(get("/api/v1/notifications/unread-count").header("Authorization",bearer(resident)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(2));
        var notification=notifications.findAll().stream().filter(n->n.getRequestId().equals(request.getId())).findFirst().orElseThrow();
        mvc.perform(patch("/api/v1/notifications/{id}/read",notification.getId()).header("Authorization",bearer(resident))
                .contentType(MediaType.APPLICATION_JSON).content("{\"read\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.read").value(true));
        mvc.perform(patch("/api/v1/notifications/read-all").header("Authorization",bearer(resident))).andExpect(status().isNoContent());
    }

    @Test void ownershipIsConcealedAndRolesAreEnforcedBeforeBodyValidation() throws Exception {
        var owner=user(Role.USER); var other=user(Role.USER); var admin=user(Role.ADMIN); var service=service(admin);
        var request=request(owner,service,RequestStatus.PENDING,LocalDate.now(clock).plusDays(1));
        String itemPath="/api/v1/requests/"+request.getId();
        mvc.perform(get("/api/v1/requests")).andExpect(status().isUnauthorized());
        mvc.perform(get(itemPath)).andExpect(status().isUnauthorized());
        mvc.perform(get(itemPath+"/history")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/requests").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/notifications")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/requests/{id}",request.getId()).header("Authorization",bearer(other))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/requests/{id}/history",request.getId()).header("Authorization",bearer(other))).andExpect(status().isNotFound());
        mvc.perform(get(itemPath).header("Authorization",bearer(admin))).andExpect(status().isOk());
        var superAdmin=users.findByRole(Role.SUPER_ADMIN).get(0);
        mvc.perform(get(itemPath).header("Authorization",bearer(superAdmin))).andExpect(status().isOk());
        mvc.perform(patch("/api/v1/requests/{id}",request.getId()).header("Authorization",bearer(owner)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(post("/api/v1/requests").header("Authorization",bearer(admin)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/notifications").header("Authorization",bearer(admin))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/notifications").header("Authorization",bearer(superAdmin))).andExpect(status().isForbidden());
    }

    @Test void invalidTransitionsRejectionRemarksAndRemarksOnlyRulesAreEnforced() throws Exception {
        var resident=user(Role.USER); var admin=user(Role.ADMIN); var service=service(admin);
        var request=request(resident,service,RequestStatus.PENDING,LocalDate.now(clock).plusDays(1));
        String path="/api/v1/requests/"+request.getId(); String adminToken=bearer(admin);
        mvc.perform(patch(path).header("Authorization",adminToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"REJECTED\"}")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details[0].field").value("adminRemarks"));
        mvc.perform(patch(path).header("Authorization",adminToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"COMPLETED\"}")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));
        mvc.perform(patch(path).header("Authorization",adminToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"adminRemarks\":\"  Check valve  \"}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.adminRemarks").value("Check valve"));
        assertThat(history.findByRequestIdOrderByCreatedAtAscIdAsc(request.getId())).hasSize(1);
        assertThat(notifications.findAll()).noneMatch(n->n.getRequestId().equals(request.getId()));
        mvc.perform(patch(path).header("Authorization",adminToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"REJECTED\",\"adminRemarks\":\"Unable to repair\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"));
        mvc.perform(patch(path).header("Authorization",adminToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"adminRemarks\":\"closed note\"}")).andExpect(status().isConflict());
        assertThat(history.findByRequestIdOrderByCreatedAtAscIdAsc(request.getId())).hasSize(2);
        assertThat(notifications.findAll()).filteredOn(n->n.getRequestId().equals(request.getId())).hasSize(1);
    }

    @Test void overdueFlagAndFiltersUseConfiguredApplicationDate() throws Exception {
        var resident=user(Role.USER); var admin=user(Role.ADMIN); var service=service(admin); var today=LocalDate.now(clock);
        var pending=request(resident,service,RequestStatus.PENDING,today.minusDays(1));
        var completed=request(resident,service,RequestStatus.COMPLETED,today.minusDays(1));
        var todayPending=request(resident,service,RequestStatus.PENDING,today);
        mvc.perform(get("/api/v1/requests").param("overdue","true").header("Authorization",bearer(resident)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(pending.getId())).andExpect(jsonPath("$.content[0].overdue").value(true));
        mvc.perform(get("/api/v1/requests").param("overdue","false").param("status",RequestStatus.PENDING.name())
                .header("Authorization",bearer(resident))).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(todayPending.getId()));
        mvc.perform(get("/api/v1/requests").param("overdue","true").param("status",RequestStatus.COMPLETED.name())
                .header("Authorization",bearer(resident))).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        assertThat(completed.getStatus()).isEqualTo(RequestStatus.COMPLETED);
    }

    @Test void creationValidationRejectsInactiveUnknownPastAndUnknownFields() throws Exception {
        var resident=user(Role.USER); var admin=user(Role.ADMIN); var inactive=service(admin);
        inactive.setActive(false,clock.instant()); services.saveAndFlush(inactive);
        String token=bearer(resident);
        mvc.perform(post("/api/v1/requests").header("Authorization",token).contentType(MediaType.APPLICATION_JSON)
                .content(createJson(inactive.getId(),"Valid description",LocalDate.now(clock).plusDays(1))))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(post("/api/v1/requests").header("Authorization",token).contentType(MediaType.APPLICATION_JSON)
                .content(createJson(Long.MAX_VALUE,"Valid description",LocalDate.now(clock).plusDays(1))))
                .andExpect(status().isNotFound());
        var active=service(admin);
        mvc.perform(post("/api/v1/requests").header("Authorization",token).contentType(MediaType.APPLICATION_JSON)
                .content(createJson(active.getId(),"Valid description",LocalDate.now(clock).minusDays(1))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.details[0].field").value("expectedCompletionDate"));
        mvc.perform(post("/api/v1/requests").header("Authorization",token).contentType(MediaType.APPLICATION_JSON)
                .content(createJson(active.getId(),"tiny",LocalDate.now(clock).plusDays(1))))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/requests").header("Authorization",token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"serviceId\":"+active.getId()+",\"description\":\"valid description\",\"expectedCompletionDate\":\""+
                        LocalDate.now(clock).plusDays(1)+"\",\"residentId\":"+resident.getId()+"}"))
                .andExpect(status().isBadRequest());
    }

    @Test void requestSearchUsesLiteralWildcardsAndCombinesFiltersAndPagination() throws Exception {
        var resident=user(Role.USER); var admin=user(Role.ADMIN); var service=service(admin);
        String marker=UUID.randomUUID().toString().substring(0,8);
        resident.updateProfile("Pipe-"+marker+"% Owner",resident.getEmail(),"A_"+marker+"FLAT",clock.instant()); users.saveAndFlush(resident);
        var first=request(resident,service,RequestStatus.PENDING,LocalDate.now(clock).plusDays(1));
        var second=request(resident,service,RequestStatus.PENDING,LocalDate.now(clock).plusDays(2));
        String path="/api/v1/requests";
        mvc.perform(get(path).param("q",marker+"%").header("Authorization",bearer(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get(path).param("q","_"+marker).param("status",RequestStatus.PENDING.name()).param("page","0").param("size","1")
                .header("Authorization",bearer(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get(path).param("q",marker+"%").param("status",RequestStatus.COMPLETED.name()).header("Authorization",bearer(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(path).param("sort","residentId,asc").header("Authorization",bearer(admin)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get(path).header("Authorization",bearer(resident))).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        assertThat(first.getId()).isNotEqualTo(second.getId());
    }

    @Test void notificationReadIsIdempotentAndOwnershipIsConcealed() throws Exception {
        var resident=user(Role.USER); var another=user(Role.USER); var admin=user(Role.ADMIN); var service=service(admin);
        var request=request(resident,service,RequestStatus.PENDING,LocalDate.now(clock).plusDays(1));
        mvc.perform(patch("/api/v1/requests/{id}",request.getId()).header("Authorization",bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}")).andExpect(status().isOk());
        var notification=notifications.findAll().stream().filter(n->n.getRequestId().equals(request.getId())).findFirst().orElseThrow();
        mvc.perform(patch("/api/v1/notifications/{id}/read",notification.getId()).header("Authorization",bearer(another))
                .contentType(MediaType.APPLICATION_JSON).content("{\"read\":true}"))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/api/v1/notifications/{id}/read",notification.getId()).header("Authorization",bearer(resident))
                .contentType(MediaType.APPLICATION_JSON).content("{\"read\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.read").value(true));
        var firstReadAt=notifications.findById(notification.getId()).orElseThrow().getReadAt();
        mvc.perform(patch("/api/v1/notifications/{id}/read",notification.getId()).header("Authorization",bearer(resident))
                .contentType(MediaType.APPLICATION_JSON).content("{\"read\":true}"))
                .andExpect(status().isOk());
        assertThat(notifications.findById(notification.getId()).orElseThrow().getReadAt()).isEqualTo(firstReadAt);
        mvc.perform(get("/api/v1/notifications").param("unreadOnly","true").header("Authorization",bearer(resident)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(patch("/api/v1/notifications/read-all").header("Authorization",bearer(resident))).andExpect(status().isNoContent());
    }

    @Test void concurrentStatusUpdatesProduceOneHistoryEntryAndOneNotification() throws Exception {
        var resident=user(Role.USER); var firstAdmin=user(Role.ADMIN); var secondAdmin=user(Role.ADMIN); var service=service(firstAdmin);
        var request=request(resident,service,RequestStatus.PENDING,LocalDate.now(clock).plusDays(1));
        String path="/api/v1/requests/"+request.getId(); var ready=new CountDownLatch(2); var start=new CountDownLatch(1);
        var pool=Executors.newFixedThreadPool(2);
        try {
            String firstToken=bearer(firstAdmin), secondToken=bearer(secondAdmin);
            Callable<org.springframework.test.web.servlet.MvcResult> updateOne=()->{ready.countDown();start.await();return mvc.perform(patch(path).header("Authorization",firstToken)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}")).andReturn();};
            Callable<org.springframework.test.web.servlet.MvcResult> updateTwo=()->{ready.countDown();start.await();return mvc.perform(patch(path).header("Authorization",secondToken)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}")).andReturn();};
            var one=pool.submit(updateOne); var two=pool.submit(updateTwo);
            assertThat(ready.await(10,TimeUnit.SECONDS)).as("Both concurrent request workers must be ready").isTrue();
            start.countDown();
            var results=List.of(one.get(30,TimeUnit.SECONDS),two.get(30,TimeUnit.SECONDS));
            var statuses=results.stream().map(result->result.getResponse().getStatus()).toList();
            var bodies=results.stream().map(result->{try{return result.getResponse().getContentAsString();}catch(Exception ex){return "<unreadable response>";}}).toList();
            assertThat(statuses).withFailMessage("path=%s params={status=IN_PROGRESS} actors={ADMIN,ADMIN} responseBodies=%s",path,bodies)
                    .containsExactlyInAnyOrder(200,409);
        } finally { pool.shutdownNow(); }
        assertThat(history.findByRequestIdOrderByCreatedAtAscIdAsc(request.getId())).hasSize(2);
        assertThat(notifications.findAll()).filteredOn(n->n.getRequestId().equals(request.getId())).hasSize(1);
    }

    private UserAccount user(Role role){String tag=UUID.randomUUID().toString(); String fullName="Workflow "+role; String email=tag+"@example.test";
        String flat=role==Role.USER?"T-"+Integer.toHexString(FLAT_SEQUENCE.incrementAndGet()):null;
        requireMax("fullName",fullName,120); requireMax("email",email,254); if(flat!=null) requireMax("flatNumber",flat,12);
        return users.saveAndFlush(UserAccount.create(fullName,email,encoder.encode("Password123"),role,flat,clock.instant()));}
    private ServiceItem service(UserAccount admin){String name="Test service "+UUID.randomUUID(); requireMax("service.name",name,100);
        return services.saveAndFlush(ServiceItem.create(name,"desc",admin.getId(),clock.instant()));}
    private com.rms.resident.request.ServiceRequest request(UserAccount resident,ServiceItem service,RequestStatus status,LocalDate expected){
        String description="Request description"; requireMax("service_requests.description",description,1000);
        if(resident.getFlatNumber()!=null) requireMax("service_requests.flat_number",resident.getFlatNumber(),30);
        var req=com.rms.resident.request.ServiceRequest.create(resident.getId(),resident.getFlatNumber(),service.getId(),description,LocalDate.now(clock).minusDays(1),expected,clock.instant());
        if(status!=RequestStatus.PENDING) req.changeStatus(status,null,clock.instant());
        req=requests.saveAndFlush(req);
        history.saveAndFlush(com.rms.resident.request.RequestStatusHistory.create(req.getId(),null,RequestStatus.PENDING,resident.getId(),null,clock.instant()));
        return req;
    }
    private String bearer(UserAccount user){String token=jwt.issue(user).value();tokenRoles.put(token,user.getRole());return "Bearer "+token;}
    private void requireMax(String field,String value,int max){assertThat(value.codePointCount(0,value.length())).as("Generated %s must not exceed schema limit %s: %s",field,max,value).isLessThanOrEqualTo(max);}
    private final class ContextualMvc {
        ResultActions perform(MockHttpServletRequestBuilder builder) throws Exception {
            return new ContextualResultActions(rawMvc.perform(builder).andReturn());
        }
    }
    private final class ContextualResultActions implements ResultActions {
        private final MvcResult result;
        private ContextualResultActions(MvcResult result){this.result=result;}
        @Override public ResultActions andExpect(ResultMatcher matcher) throws Exception {
            try { matcher.match(result); }
            catch (Throwable failure) {
                String header=result.getRequest().getHeader("Authorization");
                String token=header!=null&&header.startsWith("Bearer ")?header.substring(7):null;
                Role actor=token==null?null:tokenRoles.get(token);
                String params=result.getRequest().getQueryString();
                String requestBody=new String(result.getRequest().getContentAsByteArray(),java.nio.charset.StandardCharsets.UTF_8);
                String responseBody=result.getResponse().getContentAsString();
                throw new AssertionError("Request assertion failed: path="+result.getRequest().getMethod()+" "+result.getRequest().getRequestURI()
                        +" params="+(params==null?"{}":params)+" actorRole="+(actor==null?"ANONYMOUS":actor)
                        +" requestBody="+requestBody+" responseBody="+responseBody,failure);
            }
            return this;
        }
        @Override public ResultActions andDo(ResultHandler handler) throws Exception { handler.handle(result); return this; }
        @Override public MvcResult andReturn(){return result;}
    }
    private String createJson(Long serviceId,String description,LocalDate expected){return "{\"serviceId\":"+serviceId+
            ",\"description\":\""+description+"\",\"expectedCompletionDate\":\""+expected+"\"}";}
}
