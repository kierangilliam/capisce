package accounts

import (
	"errors"
	"sort"
	"strings"
)

var (
	ErrAgentNotFound = errors.New("that agent does not exist")
	ErrLastLead      = errors.New("a team must keep at least one active lead")
)

// Agents lists the agents on the signed-in agent's team, leads first.
func (d *Directory) Agents(actor Actor) ([]Agent, error) {
	if !actor.IsAgent() {
		return nil, ErrNotAllowed
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	var team []Agent
	for _, agent := range d.agents {
		if agent.TeamID == actor.TeamID {
			team = append(team, agent)
		}
	}
	sort.Slice(team, func(i, j int) bool {
		if team[i].Lead != team[j].Lead {
			return team[i].Lead
		}
		return team[i].Name < team[j].Name
	})
	return team, nil
}

// Agent finds one agent by id.
func (d *Directory) Agent(id string) (Agent, bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	agent, found := d.agents[id]
	return agent, found
}

// LeadsOf lists a team's active leads, by id.
func (d *Directory) LeadsOf(teamID string) []Agent {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.activeLeads(teamID)
}

func (d *Directory) activeLeads(teamID string) []Agent {
	var leads []Agent
	for _, agent := range d.agents {
		if agent.TeamID == teamID && agent.Lead && agent.Active {
			leads = append(leads, agent)
		}
	}
	sort.Slice(leads, func(i, j int) bool { return leads[i].ID < leads[j].ID })
	return leads
}

// TeamForTopic picks the team that handles a topic. A topic no team lists
// goes to the catch-all team.
func (d *Directory) TeamForTopic(topic string) Team {
	d.mu.Lock()
	defer d.mu.Unlock()
	topic = strings.ToLower(strings.TrimSpace(topic))
	var catchAll Team
	for _, team := range d.teams {
		for _, handled := range team.Topics {
			if handled == topic {
				return team
			}
		}
		if team.CatchAll {
			catchAll = team
		}
	}
	return catchAll
}

// Deactivate turns off an agent's account and signs them out. Only a lead
// of the same team may do it, and a team keeps at least one active lead.
func (d *Directory) Deactivate(actor Actor, id string) (Agent, error) {
	if !actor.Lead {
		return Agent{}, ErrNotAllowed
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	agent, found := d.agents[id]
	if !found || agent.TeamID != actor.TeamID {
		return Agent{}, ErrAgentNotFound
	}
	if !agent.Active {
		return agent, nil
	}
	if agent.Lead && len(d.activeLeads(agent.TeamID)) == 1 {
		return Agent{}, ErrLastLead
	}
	agent.Active = false
	d.agents[id] = agent
	for token, session := range d.sessions {
		if session.AgentID == id {
			delete(d.sessions, token)
		}
	}
	return agent, nil
}
