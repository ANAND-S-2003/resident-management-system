package com.rms.resident.user;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class UserAdministrationConfiguration {
    @Bean UserAccessPolicy userAccessPolicy() { return new UserAccessPolicy(); }
}
