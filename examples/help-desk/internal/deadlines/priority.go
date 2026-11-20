// Package deadlines works out how long a customer may wait for a reply.
package deadlines

import (
	"errors"
	"strings"
)

// Priority says how urgent a ticket is.
type Priority string

const (
	Low    Priority = "low"
	Normal Priority = "normal"
	High   Priority = "high"
	Urgent Priority = "urgent"
)

var ErrUnknownPriority = errors.New("the priority must be low, normal, high or urgent")

var ladder = []Priority{Low, Normal, High, Urgent}

// ParsePriority reads a priority from text. Empty text means normal.
func ParsePriority(text string) (Priority, error) {
	text = strings.ToLower(strings.TrimSpace(text))
	if text == "" {
		return Normal, nil
	}
	for _, priority := range ladder {
		if string(priority) == text {
			return priority, nil
		}
	}
	return "", ErrUnknownPriority
}

// Raised is the priority one step up. Urgent stays urgent.
func (p Priority) Raised() Priority {
	for index, priority := range ladder {
		if priority == p && index < len(ladder)-1 {
			return ladder[index+1]
		}
	}
	return p
}

// Above reports whether p is more urgent than other.
func (p Priority) Above(other Priority) bool {
	return rank(p) > rank(other)
}

func rank(priority Priority) int {
	for index, each := range ladder {
		if each == priority {
			return index
		}
	}
	return 0
}
