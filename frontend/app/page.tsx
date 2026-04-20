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
          }`}
      >
        <span>{displayLabel}</span>
        <span className={`text-gray-500 dark:text-gray-400 ml-2 text-sm transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute z-10 w-full mt-1 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 max-h-60 overflow-y-auto bg-white dark:bg-gray-800"
        >
          {options.map((option) => (
            <li
              key={option.value}
              onClick={() => handleSelect(option.value)}
              role="option"
              // FIX: Pass boolean directly. React handles the string conversion for ARIA attributes.
              aria-selected={option.value === value}
              className={`px-4 py-2 cursor-pointer transition-colors duration-100 last:rounded-b-lg first:rounded-t-lg ${option.value === value
                ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 font-semibold'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
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
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Options data for the custom dropdowns
  const educationOptions: Option[] = [
    { value: "Graduate", label: "Graduate" },
    { value: "Not Graduate", label: "Not Graduate" },
  ];

  const selfEmployedOptions: Option[] = [
    { value: "Yes", label: "Yes" },
    { value: "No", label: "No" },
  ];

  // Validation functions for each step
  const isStep1Valid = (): boolean => {
    return (
      form.no_of_dependents !== null &&
      form.education !== "" &&
      form.self_employed !== "" &&
      form.cibil_score !== null
    );
  };

  const isStep2Valid = (): boolean => {
    return (
      form.income_annum !== null &&
      form.loan_amount !== null &&
      form.loan_term !== null
    );
  };

  const isStep3Valid = (): boolean => {
    return (
      form.residential_assets_value !== null &&
      form.commercial_assets_value !== null &&
      form.luxury_assets_value !== null &&
      form.bank_asset_value !== null
    );
  };

  const handleNextStep = () => {
    if (currentStep === 1 && isStep1Valid()) {
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2 && isStep2Valid()) {
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3 && isStep3Valid()) {
      setCurrentStep(4);
      return;
    }

    alert("Please fill out all fields in this section.");
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };


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
    <main className="flex flex-col items-center bg-gray-50 dark:bg-gray-900 px-5 py-10 transition-colors min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 border border-gray-200 dark:border-gray-700 transition-all duration-300"
      >
        <h1 className="text-3xl font-bold text-center mb-2 text-blue-800 dark:text-blue-500">
          FinTech-Approve
        </h1>
        <p className="text-center text-white-900 dark:text-white-900 mb-8">
          Fill in your financial details to check your loan approval chances.
        </p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5">
          <div className="col-span-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-5 shadow-lg transition duration-300">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-white-900 dark:text-white-900">Progress</p>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Loan approval journey</h2>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${currentStep === step
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                      }`}
                  >
                    Step {step}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* STEP 1: Applicant Information */}
          {currentStep === 1 && (
            <div className="col-span-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-8 shadow-lg transition duration-300">
              <div className="mb-6 flex flex-col gap-2">
                <p className="text-sm uppercase tracking-wide font-bold text-blue-600 dark:text-blue-500">Step 1 of 4</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Applicant Information</h3>
                <p className="max-w-2xl text-white-900 dark:text-white-900">Tell us about the borrower profile so we can personalize the approval estimate.</p>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-200 focus-within:border-blue-500">
                  <label htmlFor="dependents" className="label">Number of Dependents</label>
                  <input
                    id="dependents"
                    name="no_of_dependents"
                    type="number"
                    placeholder="e.g., 2"
                    value={form.no_of_dependents ?? ''}
                    onChange={handleChange}
                    min={0}
                    className="input focus:ring-2 focus:ring-blue-500 transition-shadow duration-200"
                  />
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-200 focus-within:border-blue-500">
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

                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-200 focus-within:border-blue-500">
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

                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-200 focus-within:border-blue-500">
                  <label htmlFor="cibil_score" className="label">CIBIL Score</label>
                  <input
                    id="cibil_score"
                    name="cibil_score"
                    type="number"
                    placeholder="e.g., 750 (300-900)"
                    value={form.cibil_score ?? ''}
                    onChange={handleChange}
                    min={0}
                    max={900}
                    className="input focus:ring-2 focus:ring-blue-500 transition-shadow duration-200"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-7 py-3 text-base font-semibold text-white shadow-sm transition duration-300 hover:bg-blue-700"
                >
                  Continue to Financials
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Financial Details */}
          {currentStep === 2 && (
            <div className="col-span-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-8 shadow-lg transition duration-300">
              <div className="mb-6 flex flex-col gap-2">
                <p className="text-sm uppercase tracking-wide text-blue-600 font-bold dark:text-blue-400">Step 2 of 4</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Details</h3>
                <p className="max-w-2xl text-white-900 dark:text-white-900">Add your income and loan request details so we can estimate your approval likelihood.</p>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-200 focus-within:border-blue-500">
                  <label htmlFor="income_annum" className="label">Annual Income (₹)</label>
                  <input id="income_annum" name="income_annum" type="number" placeholder="e.g., 4000000" value={form.income_annum ?? ''} onChange={handleChange} min={0} className="input focus:ring-2 focus:ring-blue-500 transition-shadow duration-200" />
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-200 focus-within:border-blue-500">
                  <label htmlFor="loan_amount" className="label">Requested Loan Amount (₹)</label>
                  <input id="loan_amount" name="loan_amount" type="number" placeholder="e.g., 15000000" value={form.loan_amount ?? ''} onChange={handleChange} min={0} className="input focus:ring-2 focus:ring-blue-500 transition-shadow duration-200" />
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-200 focus-within:border-blue-500">
                  <label htmlFor="loan_term" className="label">Loan Term (Years)</label>
                  <input id="loan_term" name="loan_term" type="number" placeholder="e.g., 15" value={form.loan_term ?? ''} onChange={handleChange} min={0} className="input focus:ring-2 focus:ring-blue-500 transition-shadow duration-200" />
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 shadow-sm transition duration-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-7 py-3 text-base font-semibold text-white shadow-sm transition duration-300 hover:bg-blue-700"
                >
                  Continue to Assets
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Assets Information */}
          {currentStep === 3 && (
            <div className="col-span-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-8 shadow-lg transition duration-300">
              <div className="mb-6 flex flex-col gap-2">
                <p className="text-sm uppercase tracking-wide text-blue-600 font-bold dark:text-blue-400">Step 3 of 4</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Assets Information</h3>
                <p className="max-w-2xl text-white-900 dark:text-white-900">Share your asset profile to complete the loan recommendation process.</p>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-200 focus-within:border-blue-500">
                  <label htmlFor="residential_assets_value" className="label">Residential Assets Value (₹)</label>
                  <input id="residential_assets_value" name="residential_assets_value" type="number" placeholder="e.g., 5000000" value={form.residential_assets_value ?? ''} onChange={handleChange} min={0} className="input focus:ring-2 focus:ring-blue-500 transition-shadow duration-200" />
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-200 focus-within:border-blue-500">
                  <label htmlFor="commercial_assets_value" className="label">Commercial Assets Value (₹)</label>
                  <input id="commercial_assets_value" name="commercial_assets_value" type="number" placeholder="e.g., 1000000" value={form.commercial_assets_value ?? ''} onChange={handleChange} min={0} className="input focus:ring-2 focus:ring-blue-500 transition-shadow duration-200" />
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-200 focus-within:border-blue-500">
                  <label htmlFor="luxury_assets_value" className="label">Luxury Assets Value (₹)</label>
                  <input id="luxury_assets_value" name="luxury_assets_value" type="number" placeholder="e.g., 2000000" value={form.luxury_assets_value ?? ''} onChange={handleChange} min={0} className="input focus:ring-2 focus:ring-blue-500 transition-shadow duration-200" />
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-200 focus-within:border-blue-500">
                  <label htmlFor="bank_asset_value" className="label">Bank Balance (₹)</label>
                  <input id="bank_asset_value" name="bank_asset_value" type="number" placeholder="e.g., 500000" value={form.bank_asset_value ?? ''} onChange={handleChange} min={0} className="input focus:ring-2 focus:ring-blue-500 transition-shadow duration-200" />
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 shadow-sm transition duration-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-7 py-3 text-base font-semibold text-white shadow-sm transition duration-300 hover:bg-blue-700"
                >
                  Continue to Summary
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Review Summary */}
          {currentStep === 4 && (
            <div className="col-span-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-8 shadow-lg transition duration-300">
              <div className="mb-6 flex flex-col gap-2">
                <p className="text-sm uppercase tracking-wide text-blue-600 font-bold dark:text-blue-400">Step 4 of 4</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Review your application</h3>
                <p className="max-w-2xl text-white-900 dark:text-white-900">Confirm the details below before submitting your loan request.</p>
              </div>

              <div className="grid gap-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-300">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-wide text-white-500 dark:text-white-400">Applicant</p>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition duration-300 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                    >
                      Edit section
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-800 dark:text-white">Dependents</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{form.no_of_dependents}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-800 dark:text-white">Education</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{form.education}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-800 dark:text-white">Self Employed</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{form.self_employed}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-800 dark:text-white">CIBIL Score</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{form.cibil_score}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-300">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-wide text-white-500 dark:text-white-400">Financial details</p>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition duration-300 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                    >
                      Edit section
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-800 dark:text-white">Annual Income</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">₹{form.income_annum}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-800 dark:text-white">Loan Amount</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">₹{form.loan_amount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-800 dark:text-white">Loan Term</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{form.loan_term} years</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-5 shadow-md transition duration-300">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-wide text-white-500 dark:text-white-400">Assets</p>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition duration-300 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                    >
                      Edit section
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-800 dark:text-white">Residential</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">₹{form.residential_assets_value}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-800 dark:text-white">Commercial</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">₹{form.commercial_assets_value}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-800 dark:text-white">Luxury</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">₹{form.luxury_assets_value}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-800 dark:text-white">Bank Balance</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">₹{form.bank_asset_value}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 shadow-sm transition duration-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-7 py-3 text-base font-semibold text-white shadow-sm transition duration-300 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Analyzing..." : "Submit & Predict"}
                </button>
              </div>
            </div>
          )}
        </form>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-8 text-center rounded-lg p-6 font-semibold shadow-xl ${result.loan_approval === "Approved"
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