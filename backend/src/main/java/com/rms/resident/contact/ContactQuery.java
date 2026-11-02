package com.rms.resident.contact;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "contact_queries")
public class ContactQuery {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "submitted_by")
    private Long submittedBy;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(nullable = false, length = 254)
    private String email;
    @Column(nullable = false, length = 200)
    private String subject;
    @Column(nullable = false, length = 2000)
    private String message;
    @Column(name = "created_at", nullable = false, columnDefinition = "DATETIME(6)")
    private Instant createdAt;

    protected ContactQuery() {}

    public static ContactQuery create(Long submittedBy,String name,String email,String subject,String message,Instant createdAt) {
        ContactQuery query=new ContactQuery(); query.submittedBy=submittedBy; query.name=name; query.email=email;
        query.subject=subject; query.message=message; query.createdAt=createdAt; return query;
    }
    public Long getId(){return id;} public Long getSubmittedBy(){return submittedBy;} public String getName(){return name;}
    public String getEmail(){return email;} public String getSubject(){return subject;} public String getMessage(){return message;}
    public Instant getCreatedAt(){return createdAt;}
}
