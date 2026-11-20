package web

import (
	"net/http"

	"example.com/helpdesk/internal/accounts"
	"example.com/helpdesk/internal/tickets"
)

func (s *Server) listTickets(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	status := tickets.Status(r.URL.Query().Get("status"))
	writeJSON(w, http.StatusOK, s.Tickets.List(actor, status))
}

func (s *Server) openTicket(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	var in tickets.OpenInput
	if err := readJSON(r, &in); err != nil {
		writeError(w, err)
		return
	}
	ticket, err := s.Tickets.Open(actor, in, s.Now())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, ticket)
}

func (s *Server) showTicket(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	ticket, err := s.Tickets.Get(actor, r.PathValue("id"))
	s.answer(w, ticket, err)
}

func (s *Server) replyToTicket(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	var in struct {
		Body     string `json:"body"`
		Internal bool   `json:"internal"`
	}
	if err := readJSON(r, &in); err != nil {
		writeError(w, err)
		return
	}
	ticket, err := s.Tickets.Reply(actor, r.PathValue("id"), in.Body, in.Internal, s.Now())
	s.answer(w, ticket, err)
}

func (s *Server) assignTicket(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	var in struct {
		AgentID string `json:"agent_id"`
	}
	if err := readJSON(r, &in); err != nil {
		writeError(w, err)
		return
	}
	ticket, err := s.Tickets.Assign(actor, r.PathValue("id"), in.AgentID, s.Now())
	s.answer(w, ticket, err)
}

func (s *Server) changePriority(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	var in struct {
		Priority string `json:"priority"`
	}
	if err := readJSON(r, &in); err != nil {
		writeError(w, err)
		return
	}
	ticket, err := s.Tickets.ChangePriority(actor, r.PathValue("id"), in.Priority, s.Now())
	s.answer(w, ticket, err)
}

func (s *Server) escalateTicket(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	var in struct {
		Reason string `json:"reason"`
	}
	if err := readJSON(r, &in); err != nil {
		writeError(w, err)
		return
	}
	ticket, err := s.Tickets.Escalate(actor, r.PathValue("id"), in.Reason, s.Now())
	s.answer(w, ticket, err)
}

func (s *Server) closeTicket(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	ticket, err := s.Tickets.Close(actor, r.PathValue("id"), s.Now())
	s.answer(w, ticket, err)
}

func (s *Server) reopenTicket(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	ticket, err := s.Tickets.Reopen(actor, r.PathValue("id"), s.Now())
	s.answer(w, ticket, err)
}

func (s *Server) answer(w http.ResponseWriter, ticket tickets.Ticket, err error) {
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ticket)
}
