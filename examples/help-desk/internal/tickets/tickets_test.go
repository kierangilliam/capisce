package tickets

import (
	"errors"
	"testing"
	"time"

	"example.com/helpdesk/internal/accounts"
	"example.com/helpdesk/internal/deadlines"
	"example.com/helpdesk/internal/notify"
)

var (
	start    = time.Date(2025, 3, 3, 9, 0, 0, 0, time.UTC)
	customer = accounts.Actor{CustomerID: "c1"}
	stranger = accounts.Actor{CustomerID: "c2"}
	lead     = accounts.Actor{AgentID: "lead", TeamID: "support", Lead: true}
	agent    = accounts.Actor{AgentID: "agent", TeamID: "support"}
	outsider = accounts.Actor{AgentID: "other", TeamID: "billing", Lead: true}
)

func newDesk(t *testing.T) (*Service, *notify.Outbox, Ticket) {
	t.Helper()
	directory := accounts.NewDirectory()
	directory.AddTeam(accounts.Team{ID: "support", CatchAll: true})
	directory.AddTeam(accounts.Team{ID: "billing", Topics: []string{"billing"}})
	directory.AddAgent(accounts.Agent{ID: "lead", TeamID: "support", Lead: true, Active: true})
	directory.AddAgent(accounts.Agent{ID: "agent", TeamID: "support", Active: true})
	directory.AddAgent(accounts.Agent{ID: "other", TeamID: "billing", Lead: true, Active: true})
	directory.AddCustomer(accounts.Customer{ID: "c1", Plan: accounts.PlanStandard})
	directory.AddCustomer(accounts.Customer{ID: "c2", Plan: accounts.PlanFree})
	outbox := notify.NewOutbox()
	service := NewService(directory, outbox)
	ticket, err := service.Open(customer, OpenInput{Subject: "Printer", Body: "It is on fire"}, start)
	if err != nil {
		t.Fatal(err)
	}
	return service, outbox, ticket
}

func TestCanMove(t *testing.T) {
	cases := []struct {
		from, to Status
		want     bool
	}{
		{StatusNew, StatusOpen, true},
		{StatusNew, StatusClosed, true},
		{StatusOpen, StatusWaiting, true},
		{StatusOpen, StatusNew, false},
		{StatusWaiting, StatusOpen, true},
		{StatusClosed, StatusOpen, true},
		{StatusClosed, StatusWaiting, false},
		{StatusClosed, StatusClosed, false},
	}
	for _, c := range cases {
		if got := canMove(c.from, c.to); got != c.want {
			t.Errorf("canMove(%s, %s) = %v, want %v", c.from, c.to, got, c.want)
		}
	}
}

func TestWhoMaySeeATicket(t *testing.T) {
	service, _, ticket := newDesk(t)
	cases := []struct {
		name  string
		actor accounts.Actor
		want  error
	}{
		{"its customer", customer, nil},
		{"another customer", stranger, ErrTicketNotFound},
		{"an agent on its team", agent, nil},
		{"a lead of another team", outsider, ErrTicketNotFound},
	}
	for _, c := range cases {
		if _, err := service.Get(c.actor, ticket.ID); !errors.Is(err, c.want) {
			t.Errorf("%s: got %v, want %v", c.name, err, c.want)
		}
	}
}

func TestOpenRoutesAndSetsTheDeadline(t *testing.T) {
	service, outbox, ticket := newDesk(t)
	if ticket.TeamID != "support" || ticket.Status != StatusNew {
		t.Fatalf("got team %s, status %s", ticket.TeamID, ticket.Status)
	}
	if want := start.Add(8 * time.Hour); !ticket.DueAt.Equal(want) {
		t.Errorf("due %s, want %s", ticket.DueAt, want)
	}
	if len(outbox.For(notify.ToAgent("lead"))) != 1 {
		t.Error("the lead was not told about the new ticket")
	}
	_, err := service.Open(stranger, OpenInput{Subject: "s", Body: "b", Priority: "urgent"}, start)
	if !errors.Is(err, ErrPriorityNotAllowed) {
		t.Errorf("free plan, urgent: got %v", err)
	}
	billing, _ := service.Open(stranger, OpenInput{Subject: "s", Body: "b", Topic: "Billing"}, start)
	if billing.TeamID != "billing" {
		t.Errorf("billing topic went to %s", billing.TeamID)
	}
}

func TestRepliesMoveTheTicket(t *testing.T) {
	service, _, ticket := newDesk(t)
	answered, err := service.Reply(agent, ticket.ID, "Use water", false, start.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if answered.Status != StatusWaiting || answered.AssignedAgentID != "agent" || !answered.DueAt.IsZero() {
		t.Errorf("after the agent's reply: %+v", answered)
	}
	back, _ := service.Reply(customer, ticket.ID, "Still burning", false, start.Add(2*time.Hour))
	if back.Status != StatusOpen || !back.DueAt.Equal(start.Add(10*time.Hour)) {
		t.Errorf("after the customer's reply: status %s, due %s", back.Status, back.DueAt)
	}
	if _, err := service.Reply(customer, ticket.ID, "psst", true, start); !errors.Is(err, accounts.ErrNotAllowed) {
		t.Errorf("customer note: got %v", err)
	}
	service.Reply(agent, ticket.ID, "Customer is upset", true, start.Add(3*time.Hour))
	seen, _ := service.Get(customer, ticket.ID)
	if len(seen.Replies) != 3 {
		t.Errorf("the customer sees %d replies, want 3", len(seen.Replies))
	}
}

func TestReplyToAClosedTicket(t *testing.T) {
	service, _, ticket := newDesk(t)
	closedAt := start.Add(time.Hour)
	if _, err := service.Close(agent, ticket.ID, closedAt); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Close(agent, ticket.ID, closedAt); !errors.Is(err, ErrStatusChange) {
		t.Errorf("closing twice: got %v", err)
	}
	if _, err := service.Reply(agent, ticket.ID, "hello", false, closedAt); !errors.Is(err, ErrTicketClosed) {
		t.Errorf("agent reply: got %v", err)
	}
	late := closedAt.Add(ReopenWindow + time.Minute)
	if _, err := service.Reply(customer, ticket.ID, "hello", false, late); !errors.Is(err, ErrReopenWindowPassed) {
		t.Errorf("late customer reply: got %v", err)
	}
	if _, err := service.Reopen(agent, ticket.ID, late); !errors.Is(err, ErrReopenWindowPassed) {
		t.Errorf("late reopen by an agent: got %v", err)
	}
	if _, err := service.Reopen(lead, ticket.ID, late); err != nil {
		t.Errorf("late reopen by a lead: got %v", err)
	}
	service.Close(agent, ticket.ID, late)
	reopened, err := service.Reply(customer, ticket.ID, "It came back", false, late.Add(time.Hour))
	if err != nil || reopened.Status != StatusOpen || reopened.DueAt.IsZero() {
		t.Errorf("customer reply in time: status %s, err %v", reopened.Status, err)
	}
}

func TestAssign(t *testing.T) {
	service, _, ticket := newDesk(t)
	cases := []struct {
		name  string
		actor accounts.Actor
		to    string
		want  error
	}{
		{"a customer", customer, "agent", accounts.ErrNotAllowed},
		{"an agent gives it to someone else", agent, "lead", accounts.ErrNotAllowed},
		{"a lead picks an agent of another team", lead, "other", ErrAssigneeNotInTeam},
		{"an agent takes it", agent, "", nil},
		{"an agent takes it from a colleague", accounts.Actor{AgentID: "third", TeamID: "support"}, "", accounts.ErrNotAllowed},
		{"a lead reassigns it", lead, "lead", nil},
	}
	for _, c := range cases {
		if _, err := service.Assign(c.actor, ticket.ID, c.to, start); !errors.Is(err, c.want) {
			t.Errorf("%s: got %v, want %v", c.name, err, c.want)
		}
	}
	got, _ := service.Get(lead, ticket.ID)
	if got.Status != StatusOpen || got.AssignedAgentID != "lead" {
		t.Errorf("after assigning: %s, %s", got.Status, got.AssignedAgentID)
	}
}

func TestEscalate(t *testing.T) {
	service, _, ticket := newDesk(t)
	if _, err := service.Escalate(agent, ticket.ID, "", start); !errors.Is(err, accounts.ErrNotAllowed) {
		t.Errorf("agent: got %v", err)
	}
	escalated, err := service.Escalate(lead, ticket.ID, "Big customer", start)
	if err != nil {
		t.Fatal(err)
	}
	if escalated.Priority != deadlines.High || !escalated.DueAt.Equal(start.Add(4*time.Hour)) {
		t.Errorf("priority %s, due %s", escalated.Priority, escalated.DueAt)
	}
	if _, err := service.Escalate(lead, ticket.ID, "", start); !errors.Is(err, ErrAlreadyEscalated) {
		t.Errorf("twice: got %v", err)
	}
}

func TestMarkOverdue(t *testing.T) {
	service, outbox, ticket := newDesk(t)
	if marked := service.MarkOverdue(start.Add(7 * time.Hour)); len(marked) != 0 {
		t.Fatalf("marked %v before the deadline", marked)
	}
	late := start.Add(9 * time.Hour)
	if marked := service.MarkOverdue(late); len(marked) != 1 {
		t.Fatalf("marked %v after the deadline", marked)
	}
	if marked := service.MarkOverdue(late); len(marked) != 0 {
		t.Errorf("marked %v a second time", marked)
	}
	got, _ := service.Get(lead, ticket.ID)
	if !got.Overdue || !got.Escalated || got.Priority != deadlines.High {
		t.Errorf("after the sweep: %+v", got)
	}
	report, _ := service.Overdue(agent, late)
	if len(report) != 1 {
		t.Errorf("the report lists %d tickets", len(report))
	}
	kinds := map[notify.Kind]bool{}
	for _, notice := range outbox.For(notify.ToAgent("lead")) {
		kinds[notice.Kind] = true
	}
	if !kinds[notify.TicketOverdue] {
		t.Error("the lead was not told the ticket is overdue")
	}
	if len(outbox.For(notify.ToCustomer("c1"))) != 0 {
		t.Error("the customer was told about the deadline")
	}
}
