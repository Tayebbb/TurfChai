package com.turfchai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication(scanBasePackages = "com.turfchai")
@ConfigurationPropertiesScan
public class TurfchaiApplication {

	public static void main(String[] args) {
		SpringApplication.run(TurfchaiApplication.class, args);
	}

}
