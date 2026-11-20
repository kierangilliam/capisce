// Command helpdesk runs the help desk on one port, with everything in
// memory and a few demo accounts.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"example.com/helpdesk/internal/accounts"
	"example.com/helpdesk/internal/deadlines"
	"example.com/helpdesk/internal/notify"
	"example.com/helpdesk/internal/tickets"
	"example.com/helpdesk/web"
)

func main() {
	directory := accounts.NewDirectory()
	seed(directory)
	outbox := notify.NewOutbox()
	service := tickets.NewService(directory, outbox)

	go deadlines.Watch(context.Background(), time.Minute, func(now time.Time) {
		for _, id := range service.MarkOverdue(now) {
			log.Printf("ticket %s passed its deadline", id)
		}
	})

	address := "localhost:8080"
	if port := os.Getenv("PORT"); port != "" {
		address = "localhost:" + port
	}
	log.Printf("help desk on http://%s", address)
	log.Fatal(http.ListenAndServe(address, web.NewServer(directory, service, outbox).Routes()))
}

// seed adds two teams, three agents and three customers. Every demo
// account has the password "demo".
func seed(directory *accounts.Directory) {
	password := accounts.HashPassword("demo")
	directory.AddTeam(accounts.Team{ID: "team-support", Name: "Support", CatchAll: true})
	directory.AddTeam(accounts.Team{ID: "team-billing", Name: "Billing", Topics: []string{"billing", "refund"}})
	directory.AddAgent(accounts.Agent{ID: "agent-1", Name: "Noor", Email: "noor@helpdesk.example", TeamID: "team-support", Lead: true, Active: true, PasswordHash: password})
	directory.AddAgent(accounts.Agent{ID: "agent-2", Name: "Sam", Email: "sam@helpdesk.example", TeamID: "team-support", Active: true, PasswordHash: password})
	directory.AddAgent(accounts.Agent{ID: "agent-3", Name: "Ines", Email: "ines@helpdesk.example", TeamID: "team-billing", Lead: true, Active: true, PasswordHash: password})
	directory.AddCustomer(accounts.Customer{ID: "customer-1", Name: "Ada", Email: "ada@customer.example", Plan: accounts.PlanFree, PasswordHash: password})
	directory.AddCustomer(accounts.Customer{ID: "customer-2", Name: "Bo", Email: "bo@customer.example", Plan: accounts.PlanStandard, PasswordHash: password})
	directory.AddCustomer(accounts.Customer{ID: "customer-3", Name: "Cy", Email: "cy@customer.example", Plan: accounts.PlanPremium, PasswordHash: password})
}
