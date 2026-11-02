package com.rms.resident.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rms.resident.auth.JwtService;
import com.rms.resident.catalog.ServiceItem;
import com.rms.resident.catalog.ServiceItemRepository;
import com.rms.resident.common.enums.RequestStatus;
import com.rms.resident.common.enums.Role;
import com.rms.resident.contact.ContactQueryRepository;
import com.rms.resident.request.ServiceRequest;
import com.rms.resident.request.ServiceRequestRepository;
import com.rms.resident.user.UserAccount;
import com.rms.resident.user.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties={"logging.level.org.hibernate.SQL=DEBUG","logging.level.org.hibernate.orm.jdbc.bind=TRACE"})
class DashboardContactIT {
    private static final AtomicInteger FLATS=new AtomicInteger();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry){SharedMySqlContainer.registerProperties(registry);}
    @Autowired MockMvc rawMvc; private final Map<String,Role> tokenRoles=new ConcurrentHashMap<>();
    private final ContextualMvc mvc=new ContextualMvc();
    @Autowired ObjectMapper mapper; @Autowired UserAccountRepository users;
    @Autowired ServiceItemRepository services; @Autowired ServiceRequestRepository requests;
    @Autowired ContactQueryRepository contacts; @Autowired PasswordEncoder encoder; @Autowired JwtService jwt;
    @Autowired Clock clock; @Autowired JdbcTemplate jdbc;

    @Test void dashboardAggregatesAgreeWithFilteredEndpointsForBothAdminRoles() throws Exception {
        var resident=user(Role.USER); var admin=user(Role.ADMIN); var service=service(admin); var today=LocalDate.now(clock);
        request(resident,service,RequestStatus.PENDING,today.minusDays(1));
        request(resident,service,RequestStatus.IN_PROGRESS,today.minusDays(2));
        var completed=request(resident,service,RequestStatus.COMPLETED,today.minusDays(3));
        var rejected=request(resident,service,RequestStatus.REJECTED,today.minusDays(4));
        request(resident,service,RequestStatus.PENDING,today.plusDays(1));
        String adminToken=bearer(admin); var adminPath="/api/v1/dashboard/summary";
        var adminSummary=mapper.readTree(mvc.perform(get(adminPath).header("Authorization",adminToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.activeAdmins").doesNotExist())
                .andExpect(jsonPath("$.byStatus.PENDING").value(total(admin,Map.of("status",RequestStatus.PENDING.name()))))
                .andExpect(jsonPath("$.byStatus.IN_PROGRESS").value(total(admin,Map.of("status",RequestStatus.IN_PROGRESS.name()))))
                .andExpect(jsonPath("$.byStatus.COMPLETED").value(total(admin,Map.of("status",RequestStatus.COMPLETED.name()))))
                .andExpect(jsonPath("$.byStatus.REJECTED").value(total(admin,Map.of("status",RequestStatus.REJECTED.name()))))
                .andExpect(jsonPath("$.overdueCount").value(total(admin,Map.of("overdue","true"))))
                .andExpect(jsonPath("$.totalRequests").value(total(admin,Map.of())))
                .andExpect(jsonPath("$.activeResidents").value(userTotal(admin,Role.USER))).andReturn().getResponse().getContentAsString());
        long adminStatusSum=0;for(RequestStatus status:RequestStatus.values())adminStatusSum+=adminSummary.path("byStatus").path(status.name()).asLong();
        assertThat(adminSummary.path("totalRequests").asLong()).withFailMessage(
                "path=GET %s params={} actorRole=ADMIN responseBody=%s",adminPath,adminSummary).isEqualTo(adminStatusSum);
        mvc.perform(get("/api/v1/requests/{id}",completed.getId()).header("Authorization",adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.overdue").value(false));
        mvc.perform(get("/api/v1/requests/{id}",rejected.getId()).header("Authorization",adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.overdue").value(false));
        var superAdmin=users.findByRole(Role.SUPER_ADMIN).get(0); String superToken=bearer(superAdmin);
        long beforeResidents=dashboardCount(superToken,"activeResidents");
        var superSummary=mapper.readTree(mvc.perform(get(adminPath).header("Authorization",superToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.byStatus.PENDING").value(total(superAdmin,Map.of("status",RequestStatus.PENDING.name()))))
                .andExpect(jsonPath("$.byStatus.IN_PROGRESS").value(total(superAdmin,Map.of("status",RequestStatus.IN_PROGRESS.name()))))
                .andExpect(jsonPath("$.byStatus.COMPLETED").value(total(superAdmin,Map.of("status",RequestStatus.COMPLETED.name()))))
                .andExpect(jsonPath("$.byStatus.REJECTED").value(total(superAdmin,Map.of("status",RequestStatus.REJECTED.name()))))
                .andExpect(jsonPath("$.activeAdmins").value(userTotal(superAdmin,Role.ADMIN)))
                .andExpect(jsonPath("$.activeResidents").value(beforeResidents))
                .andExpect(jsonPath("$.overdueCount").value(total(superAdmin,Map.of("overdue","true"))))
                .andExpect(jsonPath("$.totalRequests").value(total(superAdmin,Map.of()))).andReturn().getResponse().getContentAsString());
        long superStatusSum=0;for(RequestStatus status:RequestStatus.values())superStatusSum+=superSummary.path("byStatus").path(status.name()).asLong();
        assertThat(superSummary.path("totalRequests").asLong()).withFailMessage(
                "path=GET %s params={} actorRole=SUPER_ADMIN responseBody=%s",adminPath,superSummary).isEqualTo(superStatusSum);
        String activation="/api/v1/users/"+resident.getId()+"/activation";
        // Check role authorization while this USER account is still active.
        mvc.perform(get(adminPath).header("Authorization",bearer(resident))).andExpect(status().isForbidden());
        mvc.perform(patch(activation).header("Authorization",adminToken).contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isOk());
        assertThat(dashboardCount(superToken,"activeResidents")).isEqualTo(beforeResidents-1);
        mvc.perform(get(adminPath)).andExpect(status().isUnauthorized());
        mvc.perform(get(adminPath).header("Authorization",bearer(resident))).andExpect(status().isUnauthorized());
    }

    @Test void contactSubmissionValidationAttributionRateLimitAndAdminReadWork() throws Exception {
        String ip="2001:db8::"+UUID.randomUUID().toString().replace("-","");
        String script="<script>alert(\"x\")</script>";
        var anonymousBody=contactJson("  Anonymous Visitor ","  VISITOR@Example.test ","  Contact us  ","  "+script+"  ");
        var created=mapper.readTree(submit(ip,anonymousBody).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        long anonymousId=created.get("id").asLong();
        assertThat(jdbc.queryForObject("SELECT submitted_by FROM contact_queries WHERE id = ?",Long.class,anonymousId)).isNull();
        var admin=user(Role.ADMIN); var resident=user(Role.USER); String adminToken=bearer(admin), residentToken=bearer(resident);
        String authenticatedEmail="resident-"+UUID.randomUUID()+"@example.test";
        var authCreated=mapper.readTree(mvc.perform(post("/api/v1/contact-queries").header("Authorization",residentToken).with(remote(ip))
                .contentType(MediaType.APPLICATION_JSON).content(contactJson("Resident Person",authenticatedEmail,"Help request","Stored plain text")))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        long authId=authCreated.get("id").asLong();
        assertThat(jdbc.queryForObject("SELECT submitted_by FROM contact_queries WHERE id = ?",Long.class,authId)).isEqualTo(resident.getId());
        mvc.perform(post("/api/v1/contact-queries").header("Authorization",bearer(admin)).with(remote("2001:db8::a11d"))
                .contentType(MediaType.APPLICATION_JSON).content(contactJson("Admin Person","admin-"+UUID.randomUUID()+"@example.test","Help request","Admin submission")))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/contact-queries").header("Authorization",bearer(users.findByRole(Role.SUPER_ADMIN).get(0))).with(remote("2001:db8::5a"))
                .contentType(MediaType.APPLICATION_JSON).content(contactJson("Super Person","super-"+UUID.randomUUID()+"@example.test","Help request","Super admin submission")))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/contact-queries").header("Authorization",residentToken).with(remote(ip)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Resident Person\",\"email\":\"extra@example.test\",\"subject\":\"Help request\",\"message\":\"Long enough message\",\"submittedBy\":"+admin.getId()+"}"))
                .andExpect(status().isBadRequest());
        for(int i=0;i<4;i++) submit(ip,contactJson("Anonymous Visitor","limiter-"+i+"@example.test","Help request","Valid contact message"))
                .andExpect(status().isCreated());
        submit(ip,contactJson("Anonymous Visitor","limited-5@example.test","Help request","Valid contact message"))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After")).andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
        mvc.perform(post("/api/v1/contact-queries").header("Authorization",residentToken).with(remote(ip)).contentType(MediaType.APPLICATION_JSON)
                .content(contactJson("Still Authenticated","auth-ok@example.test","Help request","Authenticated requests bypass anonymous limit")))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/contact-queries").header("Authorization","Bearer invalid-token").with(remote("2001:db8::invalid"))
                .contentType(MediaType.APPLICATION_JSON).content(contactJson("Invalid Token","invalid@example.test","Help request","Valid contact message")))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(post("/api/v1/contact-queries").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/contact-queries")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/contact-queries").header("Authorization",residentToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/contact-queries/"+anonymousId).header("Authorization",adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.submittedById").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.email").value("visitor@example.test")).andExpect(jsonPath("$.message").value(script));
        mvc.perform(get("/api/v1/contact-queries/"+anonymousId)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/contact-queries/"+anonymousId).header("Authorization",residentToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/contact-queries/"+authId).header("Authorization",adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.submittedById").value(resident.getId()))
                .andExpect(jsonPath("$.message").value("Stored plain text"));
        mvc.perform(get("/api/v1/contact-queries/"+Long.MAX_VALUE).header("Authorization",adminToken)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/contact-queries").param("page","0").param("size","1").param("sort","createdAt,asc")
                .header("Authorization",adminToken)).andExpect(status().isOk()).andExpect(jsonPath("$.size").value(1));
        mvc.perform(get("/api/v1/contact-queries").param("sort","email,asc").header("Authorization",adminToken))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/v1/contact-queries/"+anonymousId).header("Authorization",bearer(users.findByRole(Role.SUPER_ADMIN).get(0))))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/contact-queries").header("Authorization",bearer(users.findByRole(Role.SUPER_ADMIN).get(0))))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/contact-queries/"+Long.MAX_VALUE)).andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.ResultActions submit(String ip,String body) throws Exception {
        return mvc.perform(post("/api/v1/contact-queries").with(remote(ip)).contentType(MediaType.APPLICATION_JSON).content(body));
    }
    private RequestPostProcessor remote(String ip){return request->{request.setRemoteAddr(ip);return request;};}
    private String contactJson(String name,String email,String subject,String message) throws Exception {
        var node=mapper.createObjectNode().put("name",name).put("email",email).put("subject",subject).put("message",message);
        return mapper.writeValueAsString(node);
    }
    private long total(UserAccount actor,Map<String,String> params) throws Exception {
        var builder=get("/api/v1/requests").param("size","1").header("Authorization",bearer(actor));
        params.forEach(builder::param);
        var result=mapper.readTree(mvc.perform(builder).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        return result.get("totalElements").asLong();
    }
    private long userTotal(UserAccount actor,Role role) throws Exception {
        return mapper.readTree(mvc.perform(get("/api/v1/users").param("role",role.name()).param("active","true").param("size","1")
                .header("Authorization",bearer(actor))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("totalElements").asLong();
    }
    private long dashboardCount(String token,String field) throws Exception {
        return mapper.readTree(mvc.perform(get("/api/v1/dashboard/summary").header("Authorization",token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get(field).asLong();
    }
    private UserAccount user(Role role){String tag=UUID.randomUUID().toString();String flat=role==Role.USER?"D-"+Integer.toHexString(FLATS.incrementAndGet()):null;
        assertThat(tag+"@example.test").hasSizeLessThanOrEqualTo(254); if(flat!=null) assertThat(flat).hasSizeLessThanOrEqualTo(30);
        return users.saveAndFlush(UserAccount.create("Dashboard "+role,tag+"@example.test",encoder.encode("Password123"),role,flat,clock.instant()));}
    private ServiceItem service(UserAccount admin){String name="Dashboard service "+UUID.randomUUID();assertThat(name).hasSizeLessThanOrEqualTo(100);
        return services.saveAndFlush(ServiceItem.create(name,"service description",admin.getId(),clock.instant()));}
    private ServiceRequest request(UserAccount resident,ServiceItem service,RequestStatus status,LocalDate expected){
        var value=ServiceRequest.create(resident.getId(),resident.getFlatNumber(),service.getId(),"Dashboard test request",
                LocalDate.now(clock).minusDays(5),expected,clock.instant());
        if(status!=RequestStatus.PENDING)value.changeStatus(status,null,clock.instant()); return requests.saveAndFlush(value);
    }
    private String bearer(UserAccount user){String token=jwt.issue(user).value();tokenRoles.put(token,user.getRole());return "Bearer "+token;}
    private final class ContextualMvc {
        ResultActions perform(MockHttpServletRequestBuilder builder)throws Exception{return new ContextualResultActions(rawMvc.perform(builder).andReturn());}
    }
    private final class ContextualResultActions implements ResultActions {
        private final MvcResult result;
        private ContextualResultActions(MvcResult result){this.result=result;}
        @Override public ResultActions andExpect(ResultMatcher matcher)throws Exception {
            try{matcher.match(result);}catch(Throwable failure){
                String header=result.getRequest().getHeader("Authorization");String token=header!=null&&header.startsWith("Bearer ")?header.substring(7):null;
                Role actor=token==null?null:tokenRoles.get(token);String query=result.getRequest().getQueryString();
                byte[] requestBytes=result.getRequest().getContentAsByteArray();
                String requestBody=requestBytes==null?"<no request body>":new String(requestBytes,java.nio.charset.StandardCharsets.UTF_8);
                throw new AssertionError("Request assertion failed: path="+result.getRequest().getMethod()+" "+result.getRequest().getRequestURI()
                        +" params="+(query==null?"{}":query)+" actorRole="+(token==null?"ANONYMOUS":actor==null?"UNAUTHENTICATED":actor)+" requestBody="+requestBody
                        +" responseBody="+result.getResponse().getContentAsString(),failure);
            }
            return this;
        }
        @Override public ResultActions andDo(ResultHandler handler)throws Exception{handler.handle(result);return this;}
        @Override public MvcResult andReturn(){return result;}
    }
}
