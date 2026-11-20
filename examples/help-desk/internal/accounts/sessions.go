package accounts

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

var (
	ErrBadCredentials = errors.New("the email or password is wrong")
	ErrAgentInactive  = errors.New("this agent account is no longer active")
	ErrNotSignedIn    = errors.New("sign in to continue")
)

const sessionLength = 12 * time.Hour

// Actor is the signed-in person behind a request: a customer or an agent.
type Actor struct {
	CustomerID string
	AgentID    string
	TeamID     string
	Lead       bool
}

func (a Actor) IsAgent() bool    { return a.AgentID != "" }
func (a Actor) IsCustomer() bool { return a.CustomerID != "" }

// SignIn checks an email and password and starts a session.
func (d *Directory) SignIn(email, password string, now time.Time) (Session, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	email = strings.ToLower(strings.TrimSpace(email))
	session := Session{Token: randomHex(16), ExpiresAt: now.Add(sessionLength)}
	for _, agent := range d.agents {
		if agent.Email != email {
			continue
		}
		if !passwordMatches(agent.PasswordHash, password) {
			return Session{}, ErrBadCredentials
		}
		if !agent.Active {
			return Session{}, ErrAgentInactive
		}
		session.AgentID = agent.ID
		d.sessions[session.Token] = session
		return session, nil
	}
	for _, customer := range d.customers {
		if customer.Email == email && passwordMatches(customer.PasswordHash, password) {
			session.CustomerID = customer.ID
			d.sessions[session.Token] = session
			return session, nil
		}
	}
	return Session{}, ErrBadCredentials
}

// SignOut ends a session. An unknown token is ignored.
func (d *Directory) SignOut(token string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	delete(d.sessions, token)
}

// Authenticate turns a session token into the person it belongs to. An
// agent's team and lead role are read fresh, so a change applies at once.
func (d *Directory) Authenticate(token string, now time.Time) (Actor, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	session, found := d.sessions[token]
	if !found {
		return Actor{}, ErrNotSignedIn
	}
	if !now.Before(session.ExpiresAt) {
		delete(d.sessions, token)
		return Actor{}, ErrNotSignedIn
	}
	if session.CustomerID != "" {
		return Actor{CustomerID: session.CustomerID}, nil
	}
	agent := d.agents[session.AgentID]
	if !agent.Active {
		delete(d.sessions, token)
		return Actor{}, ErrNotSignedIn
	}
	return Actor{AgentID: agent.ID, TeamID: agent.TeamID, Lead: agent.Lead}, nil
}

// HashPassword salts and hashes a password for storage. A real service
// would use a slow password hash; this keeps the example to the standard
// library.
func HashPassword(password string) string {
	salt := randomHex(8)
	return salt + "$" + digest(salt, password)
}

func passwordMatches(stored, password string) bool {
	salt, want, found := strings.Cut(stored, "$")
	if !found {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(want), []byte(digest(salt, password))) == 1
}

func digest(salt, password string) string {
	sum := sha256.Sum256([]byte(salt + password))
	return hex.EncodeToString(sum[:])
}

func randomHex(bytes int) string {
	buffer := make([]byte, bytes)
	if _, err := rand.Read(buffer); err != nil {
		panic(err)
	}
	return hex.EncodeToString(buffer)
}
