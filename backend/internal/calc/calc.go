// Package calc implements the pure arithmetic domain logic for the calculator
// service.
//
// Functions in this package have no knowledge of HTTP, JSON, logging, or
// configuration. They accept float64 operands and return either a result or a
// domain error. Keeping the math isolated like this makes it trivial to unit
// test and lets the same logic be reused from a CLI, a queue consumer, or the
// HTTP handlers without change.
package calc

import (
	"errors"
	"math"
)

// Domain errors returned by the operations. The HTTP layer uses errors.Is to
// translate these into protocol-specific status codes and error payloads.
var (
	// ErrDivideByZero is returned by Divide when the divisor is zero.
	ErrDivideByZero = errors.New("division by zero is undefined")

	// ErrNegativeSqrt is returned by Sqrt when the operand is negative.
	ErrNegativeSqrt = errors.New("square root of a negative number is not a real number")

	// ErrNonFiniteInput is returned when an operand is NaN or ±Inf.
	ErrNonFiniteInput = errors.New("operands must be finite numbers")

	// ErrNonFiniteResult is returned when an otherwise valid operation
	// overflows to ±Inf or is undefined (NaN), e.g. Power(0, -1).
	ErrNonFiniteResult = errors.New("result is not a finite number (overflow or undefined)")
)

// Add returns a + b.
func Add(a, b float64) (float64, error) { return checked(a, b, a+b) }

// Subtract returns a - b.
func Subtract(a, b float64) (float64, error) { return checked(a, b, a-b) }

// Multiply returns a * b.
func Multiply(a, b float64) (float64, error) { return checked(a, b, a*b) }

// Divide returns a / b. It returns ErrDivideByZero when b == 0.
func Divide(a, b float64) (float64, error) {
	if err := requireFinite(a, b); err != nil {
		return 0, err
	}
	if b == 0 {
		return 0, ErrDivideByZero
	}
	return finite(a / b)
}

// Power returns a raised to the power of b.
func Power(a, b float64) (float64, error) {
	if err := requireFinite(a, b); err != nil {
		return 0, err
	}
	return finite(math.Pow(a, b))
}

// Sqrt returns the non-negative square root of a. It returns ErrNegativeSqrt
// when a < 0.
func Sqrt(a float64) (float64, error) {
	if err := requireFinite(a); err != nil {
		return 0, err
	}
	if a < 0 {
		return 0, ErrNegativeSqrt
	}
	return finite(math.Sqrt(a))
}

// Percentage returns "a percent of b", i.e. (a / 100) * b.
// For example Percentage(15, 200) == 30.
func Percentage(a, b float64) (float64, error) {
	if err := requireFinite(a, b); err != nil {
		return 0, err
	}
	return finite((a / 100) * b)
}

// checked validates inputs and the eagerly computed result for the plain
// arithmetic operations that cannot raise a domain error of their own.
func checked(a, b, result float64) (float64, error) {
	if err := requireFinite(a, b); err != nil {
		return 0, err
	}
	return finite(result)
}

// requireFinite rejects NaN and ±Inf operands.
func requireFinite(xs ...float64) error {
	for _, x := range xs {
		if math.IsNaN(x) || math.IsInf(x, 0) {
			return ErrNonFiniteInput
		}
	}
	return nil
}

// finite guards a computed result against overflow / undefined output.
func finite(result float64) (float64, error) {
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrNonFiniteResult
	}
	return result, nil
}
