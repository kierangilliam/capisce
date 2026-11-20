package web

import (
	"net/http"

	"example.com/helpdesk/internal/accounts"
)

func (s *Server) listCustomers(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	customers, err := s.Directory.Customers(actor)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, customers)
}

func (s *Server) changePlan(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	var in struct {
		Plan accounts.Plan `json:"plan"`
	}
	if err := readJSON(r, &in); err != nil {
		writeError(w, err)
		return
	}
	customer, err := s.Directory.ChangePlan(actor, r.PathValue("id"), in.Plan)
	if err != nil {
		writeError(w, err)
		return
	}
	retimed := s.Tickets.RetimeForCustomer(customer.ID, s.Now())
	writeJSON(w, http.StatusOK, map[string]any{"customer": customer, "tickets_retimed": retimed})
}

func (s *Server) listAgents(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	agents, err := s.Directory.Agents(actor)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, agents)
}

func (s *Server) deactivateAgent(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	agent, err := s.Directory.Deactivate(actor, r.PathValue("id"))
	if err != nil {
		writeError(w, err)
		return
	}
	released := s.Tickets.ReleaseFrom(agent.ID, s.Now())
	writeJSON(w, http.StatusOK, map[string]any{"agent": agent, "tickets_released": released})
}
