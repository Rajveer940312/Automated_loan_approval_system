"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FinanceChatbot from "./FinanceChatbot";

// =================================================================
// CUSTOM SELECT COMPONENT (REQUIRED FOR DROPDOWN UI)
// =================================================================

type Option = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  name: string;
  value: string | null; // Value can be string or null
  placeholder: string;
  options: Option[];
  onChange: (e: { target: { name: string; value: string } }) => void;
  id: string;
};

const CustomSelect = ({ name, value, placeholder, options, onChange, id }: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Display value uses the actual label or the placeholder text
  const displayLabel = options.find(opt => opt.value === value)?.label || placeholder;

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (ref.current && !ref.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleClickOutside]);

  const handleSelect = (optionValue: string) => {
    onChange({ target: { name, value: optionValue } });
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={id}
        id={id}
        // Conditional class for placeholder color: value is null/empty string
        className={`input flex justify-between items-center cursor-pointer ${value === null || value === "" ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"
          } hover:shadow-md`}
      >
        <span>{displayLabel}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-500 dark:text-gray-400 ml-2 text-sm"
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            className="absolute z-10 w-full mt-1 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto"
            style={{
              backgroundColor: 'var(--input-bg, #ffffff)',
              color: 'var(--input-text, #1f2937)'
            }}
          >
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => handleSelect(option.value)}
                role="option"
                // FIX: Pass boolean directly. React handles the string conversion for ARIA attributes.
                aria-selected={option.value === value}
                className={`px-4 py-2 cursor-pointer transition-colors duration-100 last:rounded-b-xl first:rounded-t-xl ${option.value === value
                  ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 font-semibold'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
              >
                {option.label}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

// =================================================================
// HOME COMPONENT (MAIN)
// =================================================================

// NEW: Define the structure of the Risk Driver object
type RiskDriver = {
  feature: string;
  contribution_score: number;
  effect: string;
};

// NEW: Update the result state to include the risk_drivers array
type PredictResult = {
  loan_approval?: string;
  approval_probability?: number;
  risk_drivers?: RiskDriver[];
};

// Define FormState structure (numerical fields are set to null)
type FormState = {
  no_of_dependents: number | null;
  education: string;
  self_employed: string;
  income_annum: number | null;
  loan_amount: number | null;
  loan_term: number | null;
  cibil_score: number | null;
  residential_assets_value: number | null;
  commercial_assets_value: number | null;
  luxury_assets_value: number | null;
  bank_asset_value: number | null;
};


export default function Home() {
  // INITIALIZED TO NULL FOR NUMERICAL FIELDS
  const [form, setForm] = useState<FormState>({
    no_of_dependents: null,
    education: "",
    self_employed: "",
    income_annum: null,
    loan_amount: null,
    loan_term: null,
    cibil_score: null,
    residential_assets_value: null,
    commercial_assets_value: null,
    luxury_assets_value: null,
    bank_asset_value: null,
  });

  // UPDATED: Use the new PredictResult type
  const [result, setResult] = useState<PredictResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Options data for the custom dropdowns
  const educationOptions: Option[] = [
    { value: "Graduate", label: "Graduate" },
    { value: "Not Graduate", label: "Not Graduate" },
  ];

  const selfEmployedOptions: Option[] = [
    { value: "Yes", label: "Yes" },
    { value: "No", label: "No" },
  ];


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string | number | null } }) => {
    const { name, value } = e.target;

    // Handle CustomSelect (string output) or standard select (string)
    if (name === "education" || name === "self_employed") {
      setForm({ ...form, [name]: value as string });
      return;
    }

    // Handle number inputs
    const inputElement = e.target as HTMLInputElement;

    if (inputElement.type === "number") {
      // Convert empty string to null, otherwise convert to number
      const val = inputElement.value === "" ? null : Number(inputElement.value);

      // Restrict negative values if value is not null
      if (val !== null && val < 0) return;

      // Explicitly cast name to keyof FormState for type safety
      setForm(prevForm => ({ ...prevForm, [name as keyof FormState]: val }));
    } else {
      // Handle standard string inputs (though none should remain)
      setForm(prevForm => ({ ...prevForm, [name as keyof FormState]: value as string }));
    }
  };

  // NEW EFFECT: Attach JavaScript event listener to block scroll changes
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Check if the target is a number input
      if (e.target instanceof HTMLInputElement && e.target.type === 'number') {
        // Prevent the default scroll action, which changes the value
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Attach the listener to the whole window
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      // Clean up the listener when the component unmounts
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    // Basic validation check for null/empty values
    const requiredFields: (keyof FormState)[] = [
      "no_of_dependents", "education", "self_employed", "income_annum",
      "loan_amount", "loan_term", "cibil_score", "residential_assets_value",
      "commercial_assets_value", "luxury_assets_value", "bank_asset_value"
    ];

    // MODIFIED VALIDATION LOGIC: Check explicitly for null or empty string.
    const isFormValid = requiredFields.every(field => {
      const val = form[field];

      // 1. Check for null (for numerical fields)
      if (val === null) return false;

      // 2. Check for empty string (for categorical fields)
      if (typeof val === 'string' && val === "") return false;

      // 3. Optional: Check if a number is actually NaN (unlikely if inputs are restricted, but safe)
      if (typeof val === 'number' && isNaN(val)) return false;

      return true;
    });

    if (!isFormValid) {
      // Using console.error instead of alert as per instructions
      alert("Validation failed: Please fill out all fields.");
      setLoading(false);
      return;
    }

    // Ensure all numerical fields are cast to Number/float before sending to FastAPI
    const submissionData = {
      // Safely convert all fields, knowing they are not null/empty strings
      no_of_dependents: Number(form.no_of_dependents),
      education: form.education,
      self_employed: form.self_employed,
      income_annum: Number(form.income_annum),
      loan_amount: Number(form.loan_amount),
      loan_term: Number(form.loan_term),
      cibil_score: Number(form.cibil_score),
      residential_assets_value: Number(form.residential_assets_value),
      commercial_assets_value: Number(form.commercial_assets_value),
      luxury_assets_value: Number(form.luxury_assets_value),
      bank_asset_value: Number(form.bank_asset_value),
    };

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionData),
      });

      if (!res.ok) {
        // Log the error response details
        const errorData = await res.json().catch(() => ({ message: "Failed to parse API error." }));
        console.error("API Error Response:", res.status, errorData);
        setLoading(false);
        return;
      }

      const data: PredictResult = await res.json();
      setResult(data);
    } catch (error) {
      console.error("Network or API Connection Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-blue-200 dark:from-gray-900 dark:to-gray-800 px-5 py-10 transition-colors">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl bg-white dark:bg-gray-800 shadow-2xl rounded-3xl p-8 border border-gray-100 dark:border-gray-700 transition-colors"
      >
        <h1 className="text-4xl font-extrabold text-center mb-2 text-blue-800 dark:text-blue-400 tracking-tight">
          FinTech-Approve
        </h1>
        <p className="text-center text-gray-500 dark:text-gray-300 mb-8">
          Fill in your financial details to check your loan approval chances.
        </p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Applicant Info */}
          <h2 className="col-span-full text-lg font-semibold text-gray-700 dark:text-gray-200 border-b pb-1 mb-2 text-center">
            👤 Applicant Information
          </h2>

          {/* Dependents Field */}
          <div className="flex flex-col">
            <label htmlFor="dependents" className="label">Number of Dependents</label>
            <input
              id="dependents"
              name="no_of_dependents"
              type="number"
              placeholder="e.g., 2"
              value={form.no_of_dependents ?? ''} // Use nullish coalescing for display
              onChange={handleChange}
              min={0}
              className="input"
            />
          </div>

          {/* Education dropdown */}
          <div className="flex flex-col">
            <label htmlFor="education" className="label">Education Level</label>
            <CustomSelect
              id="education"
              name="education"
              value={form.education}
              placeholder="Select Education"
              options={educationOptions}
              onChange={handleChange}
            />
          </div>

          {/* Self Employed dropdown */}
          <div className="flex flex-col">
            <label htmlFor="self_employed" className="label">Self Employed Status</label>
            <CustomSelect
              id="self_employed"
              name="self_employed"
              value={form.self_employed}
              placeholder="Are you self-employed?"
              options={selfEmployedOptions}
              onChange={handleChange}
            />
          </div>

          {/* CIBIL Score Field */}
          <div className="flex flex-col">
            <label htmlFor="cibil_score" className="label">CIBIL Score</label>
            <input
              id="cibil_score"
              name="cibil_score"
              type="number"
              placeholder="e.g., 750 (300-900)"
              value={form.cibil_score ?? ''}
              onChange={handleChange}
              min={0}
              max={900} // Added max for score guidance
              className="input"
            />
          </div>


          {/* Financial Info */}
          <h2 className="col-span-full text-lg font-semibold text-gray-700 dark:text-gray-200 border-b pb-1 mt-4 mb-2 text-center">
            💰 Financial Details
          </h2>

          {/* Annual Income Field */}
          <div className="flex flex-col">
            <label htmlFor="income_annum" className="label">Annual Income (₹)</label>
            <input id="income_annum" name="income_annum" type="number" placeholder="e.g., 4000000" value={form.income_annum ?? ''} onChange={handleChange} min={0} className="input" />
          </div>

          {/* Loan Amount Field */}
          <div className="flex flex-col">
            <label htmlFor="loan_amount" className="label">Requested Loan Amount (₹)</label>
            <input id="loan_amount" name="loan_amount" type="number" placeholder="e.g., 15000000" value={form.loan_amount ?? ''} onChange={handleChange} min={0} className="input" />
          </div>

          {/* Loan Term Field */}
          <div className="flex flex-col">
            <label htmlFor="loan_term" className="label">Loan Term (Years)</label>
            <input id="loan_term" name="loan_term" type="number" placeholder="e.g., 15" value={form.loan_term ?? ''} onChange={handleChange} min={0} className="input" />
          </div>

          <span className="col-span-full"></span> {/* Empty span to balance the grid if needed */}


          {/* Assets */}
          <h2 className="col-span-full text-lg font-semibold text-gray-700 dark:text-gray-200 border-b pb-1 mt-4 mb-2 text-center">
            🏠 Assets Information
          </h2>

          {/* Residential Assets Field */}
          <div className="flex flex-col">
            <label htmlFor="residential_assets_value" className="label">Residential Assets Value (₹)</label>
            <input id="residential_assets_value" name="residential_assets_value" type="number" placeholder="e.g., 5000000" value={form.residential_assets_value ?? ''} onChange={handleChange} min={0} className="input" />
          </div>

          {/* Commercial Assets Field */}
          <div className="flex flex-col">
            <label htmlFor="commercial_assets_value" className="label">Commercial Assets Value (₹)</label>
            <input id="commercial_assets_value" name="commercial_assets_value" type="number" placeholder="e.g., 1000000" value={form.commercial_assets_value ?? ''} onChange={handleChange} min={0} className="input" />
          </div>

          {/* Luxury Assets Field */}
          <div className="flex flex-col">
            <label htmlFor="luxury_assets_value" className="label">Luxury Assets Value (₹)</label>
            <input id="luxury_assets_value" name="luxury_assets_value" type="number" placeholder="e.g., 2000000" value={form.luxury_assets_value ?? ''} onChange={handleChange} min={0} className="input" />
          </div>

          {/* Bank Assets Field */}
          <div className="flex flex-col">
            <label htmlFor="bank_asset_value" className="label">Bank Balance (₹)</label>
            <input id="bank_asset_value" name="bank_asset_value" type="number" placeholder="e.g., 500000" value={form.bank_asset_value ?? ''} onChange={handleChange} min={0} className="input" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="col-span-full mt-6 bg-blue-600 dark:bg-blue-500 text-white font-semibold py-3 rounded-xl shadow hover:bg-blue-700 dark:hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Analyzing..." : "Predict Loan Approval"}
          </button>
        </form>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-8 text-center rounded-2xl p-6 font-semibold ${result.loan_approval === "Approved"
                ? "bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300"
                : "bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300"
                }`}
            >
              <h2 className="text-2xl mb-2">
                {result.loan_approval === "Approved" ? "✅ Loan Approved" : "❌ Loan Rejected"}
              </h2>
              {result.approval_probability !== undefined && (
                <p className="text-gray-600 dark:text-gray-300 text-lg">
                  Approval Probability:{" "}
                  <span className="font-bold text-gray-800 dark:text-gray-100">
                    {Math.round(result.approval_probability * 100)}%
                  </span>
                </p>
              )}

              {/* XAI Risk Driver Visualization Section */}
              {result.risk_drivers && result.risk_drivers.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-left">
                  <h3 className="text-xl font-bold mb-3 text-gray-800 dark:text-gray-200 text-center">
                    📊 Top 3 Risk Drivers
                  </h3>
                  <ul className="space-y-2 w-full max-w-md mx-auto">
                    {/* Display only top 3 drivers for focus */}
                    {result.risk_drivers.slice(0, 3).map((driver, index) => (
                      <li key={index} className="flex justify-between items-center text-base p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-200">{driver.feature}</span>
                        <span
                          className={`font-bold py-0.5 px-2 rounded-full text-xs whitespace-nowrap ${driver.effect === "Support Rejection"
                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            }`}
                        >
                          {driver.effect === "Support Rejection" ? "RISK FACTOR" : "POSITIVE FACTOR"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs mt-3 text-gray-500 dark:text-gray-400 text-center">
                    *These factors contributed most significantly to the AI's prediction.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <footer className="mt-10 text-gray-500 dark:text-gray-400 text-sm">
        © {new Date().getFullYear()} Automated Loan Approval System | Built with FastAPI + Next.js
      </footer>

      {/* CSS Fix for Trackpad Scrolling & Default UI */}
      <style>
        {`
					/* Disable scroll-to-change functionality for number inputs */
					input[type='number'] {
						-moz-appearance: textfield; /* Firefox */
					}

					input[type='number']::-webkit-inner-spin-button, 
					input[type='number']::-webkit-outer-spin-button {
						-webkit-appearance: none;
						margin: 0;
					}
				`}
      </style>

      <FinanceChatbot />
    </main>
  );
}
