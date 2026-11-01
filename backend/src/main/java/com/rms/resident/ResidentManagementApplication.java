package com.rms.resident;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ResidentManagementApplication {
    public static void main(String[] args) {
        SpringApplication.run(ResidentManagementApplication.class, args);
    }
}
