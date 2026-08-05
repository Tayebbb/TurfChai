package com.turfchai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.turfchai")
public class TurfchaiApplication {

	public static void main(String[] args) {
		SpringApplication.run(TurfchaiApplication.class, args);
	}

}
