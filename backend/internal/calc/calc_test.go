package calc_test

import (
	"errors"
	"math"
	"testing"

	"github.com/TunahanIbis/calculator-fullstack/backend/internal/calc"
)

// almostEqual compares floats with a small tolerance so that results affected
// by IEEE-754 rounding (e.g. 0.1 + 0.2) still pass.
func almostEqual(a, b float64) bool {
	const epsilon = 1e-9
	return math.Abs(a-b) <= epsilon*math.Max(1, math.Max(math.Abs(a), math.Abs(b)))
}

func TestBinaryOperations(t *testing.T) {
	tests := []struct {
		name    string
		op      func(a, b float64) (float64, error)
		a, b    float64
		want    float64
		wantErr error
	}{
		{"add positives", calc.Add, 2, 3, 5, nil},
		{"add negatives", calc.Add, -2, -3, -5, nil},
		{"add float rounding", calc.Add, 0.1, 0.2, 0.3, nil},
		{"subtract", calc.Subtract, 10, 4, 6, nil},
		{"subtract to negative", calc.Subtract, 4, 10, -6, nil},
		{"multiply", calc.Multiply, 6, 7, 42, nil},
		{"multiply by zero", calc.Multiply, 12345, 0, 0, nil},
		{"divide even", calc.Divide, 10, 2, 5, nil},
		{"divide repeating", calc.Divide, 10, 3, 3.3333333333333335, nil},
		{"divide by zero", calc.Divide, 1, 0, 0, calc.ErrDivideByZero},
		{"divide zero by zero", calc.Divide, 0, 0, 0, calc.ErrDivideByZero},
		{"power", calc.Power, 2, 10, 1024, nil},
		{"power zero exponent", calc.Power, 123, 0, 1, nil},
		{"power negative exponent", calc.Power, 2, -1, 0.5, nil},
		{"power fractional exponent", calc.Power, 9, 0.5, 3, nil},
		{"power overflow", calc.Power, 10, 400, 0, calc.ErrNonFiniteResult},
		{"power undefined", calc.Power, 0, -1, 0, calc.ErrNonFiniteResult},
		{"percentage basic", calc.Percentage, 15, 200, 30, nil},
		{"percentage whole", calc.Percentage, 100, 50, 50, nil},
		{"percentage zero", calc.Percentage, 0, 999, 0, nil},
		{"add non-finite input", calc.Add, math.Inf(1), 1, 0, calc.ErrNonFiniteInput},
		{"subtract non-finite input", calc.Subtract, 1, math.Inf(-1), 0, calc.ErrNonFiniteInput},
		{"multiply nan input", calc.Multiply, math.NaN(), 1, 0, calc.ErrNonFiniteInput},
		{"divide non-finite input", calc.Divide, math.Inf(1), 2, 0, calc.ErrNonFiniteInput},
		{"power non-finite input", calc.Power, math.Inf(1), 2, 0, calc.ErrNonFiniteInput},
		{"percentage non-finite input", calc.Percentage, math.NaN(), 2, 0, calc.ErrNonFiniteInput},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := tc.op(tc.a, tc.b)
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected error %v, got %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !almostEqual(got, tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestSqrt(t *testing.T) {
	tests := []struct {
		name    string
		in      float64
		want    float64
		wantErr error
	}{
		{"perfect square", 144, 12, nil},
		{"zero", 0, 0, nil},
		{"non perfect square", 2, math.Sqrt2, nil},
		{"negative", -1, 0, calc.ErrNegativeSqrt},
		{"infinite input", math.Inf(1), 0, calc.ErrNonFiniteInput},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := calc.Sqrt(tc.in)
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected error %v, got %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !almostEqual(got, tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

// TestDivideByZeroMessage documents the human-readable text so a change to it
// is a deliberate decision rather than an accident (it is surfaced to users).
func TestDivideByZeroMessage(t *testing.T) {
	_, err := calc.Divide(1, 0)
	if err == nil || err.Error() != "division by zero is undefined" {
		t.Fatalf("unexpected error text: %v", err)
	}
}
