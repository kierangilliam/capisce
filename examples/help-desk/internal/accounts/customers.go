package accounts

import (
	"errors"
	"sort"
)

var (
	ErrCustomerNotFound = errors.New("that customer does not exist")
	ErrUnknownPlan      = errors.New("the plan must be free, standard or premium")
)

// Customers lists every customer, by name. Only agents may see the list.
func (d *Directory) Customers(actor Actor) ([]Customer, error) {
	if !actor.IsAgent() {
		return nil, ErrNotAllowed
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	customers := make([]Customer, 0, len(d.customers))
	for _, customer := range d.customers {
		customers = append(customers, customer)
	}
	sort.Slice(customers, func(i, j int) bool { return customers[i].Name < customers[j].Name })
	return customers, nil
}

// Customer finds one customer by id.
func (d *Directory) Customer(id string) (Customer, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	customer, found := d.customers[id]
	if !found {
		return Customer{}, ErrCustomerNotFound
	}
	return customer, nil
}

// ChangePlan moves a customer to another plan. Only a lead may do it.
func (d *Directory) ChangePlan(actor Actor, id string, plan Plan) (Customer, error) {
	if !actor.Lead {
		return Customer{}, ErrNotAllowed
	}
	if plan != PlanFree && plan != PlanStandard && plan != PlanPremium {
		return Customer{}, ErrUnknownPlan
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	customer, found := d.customers[id]
	if !found {
		return Customer{}, ErrCustomerNotFound
	}
	customer.Plan = plan
	d.customers[id] = customer
	return customer, nil
}
