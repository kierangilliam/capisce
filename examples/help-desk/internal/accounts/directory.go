// Package accounts holds the people who use the help desk: customers,
// agents and their teams, and the sessions they sign in with.
package accounts

import (
	"errors"
	"sync"
)

// ErrNotAllowed is returned when the signed-in person may not do something.
var ErrNotAllowed = errors.New("you are not allowed to do that")

// Directory keeps customers, agents, teams and sessions in memory.
type Directory struct {
	mu        sync.Mutex
	customers map[string]Customer
	agents    map[string]Agent
	teams     []Team
	sessions  map[string]Session
}

func NewDirectory() *Directory {
	return &Directory{
		customers: map[string]Customer{},
		agents:    map[string]Agent{},
		sessions:  map[string]Session{},
	}
}

// AddCustomer, AddAgent and AddTeam load the directory when the app starts.
func (d *Directory) AddCustomer(customer Customer) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.customers[customer.ID] = customer
}

func (d *Directory) AddAgent(agent Agent) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.agents[agent.ID] = agent
}

func (d *Directory) AddTeam(team Team) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.teams = append(d.teams, team)
}
