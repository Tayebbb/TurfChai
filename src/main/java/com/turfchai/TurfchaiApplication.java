package com.turfchai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication(scanBasePackages = "com.turfchai")
@ConfigurationPropertiesScan
@EnableAsync
public class TurfchaiApplication {

	public static void main(String[] args) {
		SpringApplication.run(TurfchaiApplication.class, args);
	}

}
