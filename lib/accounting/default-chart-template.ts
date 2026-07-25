import type { AccountGroupType } from "@/lib/types"

export type DefaultChartSubGroup = {
  name: string
  headPaths: string[][]
}

export type DefaultChartSemiSubGroup = {
  name: string
  subGroups: DefaultChartSubGroup[]
}

export type DefaultChartGroup = {
  name: string
  type: AccountGroupType
  semiSubGroups: DefaultChartSemiSubGroup[]
}

export const defaultChartTemplate: DefaultChartGroup[] = [
  {
    "name": "Assets",
    "type": "asset",
    "semiSubGroups": [
      {
        "name": "Non-Current Assets",
        "subGroups": [
          {
            "name": "Land & Building",
            "headPaths": [
              [
                "Land"
              ],
              [
                "Freehold Land"
              ],
              [
                "Leasehold Land"
              ],
              [
                "Building"
              ],
              [
                "Office Building"
              ],
              [
                "Factory Building"
              ],
              [
                "Warehouse Building"
              ],
              [
                "Building Improvement"
              ],
              [
                "Accumulated Depreciation - Building"
              ]
            ]
          },
          {
            "name": "Plant & Machinery",
            "headPaths": [
              [
                "Plant & Machinery"
              ],
              [
                "Production Machinery"
              ],
              [
                "Generator"
              ],
              [
                "Boiler"
              ],
              [
                "Production Equipment"
              ],
              [
                "Accumulated Depreciation - Plant & Machinery"
              ]
            ]
          },
          {
            "name": "Furniture & Fixtures",
            "headPaths": [
              [
                "Furniture & Fixtures"
              ],
              [
                "Office Furniture"
              ],
              [
                "Office Fixtures"
              ],
              [
                "Interior Decoration"
              ],
              [
                "Accumulated Depreciation - Furniture & Fixtures"
              ]
            ]
          },
          {
            "name": "Office Equipment",
            "headPaths": [
              [
                "Office Equipment"
              ],
              [
                "Photocopier"
              ],
              [
                "Printer"
              ],
              [
                "Scanner"
              ],
              [
                "Projector"
              ],
              [
                "Accumulated Depreciation - Office Equipment"
              ]
            ]
          },
          {
            "name": "Computer & IT Equipment",
            "headPaths": [
              [
                "Computer & IT Equipment"
              ],
              [
                "Desktop Computer"
              ],
              [
                "Laptop Computer"
              ],
              [
                "Server Equipment"
              ],
              [
                "Network Equipment"
              ],
              [
                "UPS"
              ],
              [
                "CCTV Equipment"
              ],
              [
                "Biometric Device"
              ],
              [
                "Software License (Perpetual)"
              ],
              [
                "Accumulated Depreciation - IT Equipment"
              ]
            ]
          },
          {
            "name": "Vehicles",
            "headPaths": [
              [
                "Motor Vehicles"
              ],
              [
                "Cars"
              ],
              [
                "Microbus"
              ],
              [
                "Motorcycle"
              ],
              [
                "Delivery Vehicle"
              ],
              [
                "Accumulated Depreciation - Vehicles"
              ]
            ]
          }
        ]
      },
      {
        "name": "Current Assets",
        "subGroups": [
          {
            "name": "Current Assets",
            "headPaths": [
              [
                "VAT Receivable"
              ],
              [
                "Income Tax Receivable"
              ],
              [
                "Other Receivables"
              ],
              [
                "Allowance for Doubtful Debts (-)"
              ]
            ]
          },
          {
            "name": "Cash & Cash Equivalents",
            "headPaths": [
              [
                "Cash in Hand",
                "Head Office Cash"
              ],
              [
                "Cash in Hand",
                "Branch Cash"
              ],
              [
                "Cash in Hand",
                "Petty Cash Fund"
              ],
              [
                "Cash at Bank",
                "Sonali Bank PLC, Motijheel Br. SB A/c #-----------"
              ],
              [
                "Cash at Bank",
                "Prime Bank PLC, Motijheel Br. SB A/c #-----------"
              ],
              [
                "Cash at Bank",
                "Eastern Bank PLC, Motijheel Br. SB A/c #-----------"
              ],
              [
                "Cash at Bank",
                "Janata Bank PLC, Motijheel Br. SB A/c #-----------"
              ],
              [
                "Cash at Bank",
                "Pubali Bank PLC, Motijheel Br. CD A/c #-----------"
              ],
              [
                "Cash at Bank",
                "Brac Bank PLC, Motijheel Br. CD A/c #-----------"
              ],
              [
                "Fixed Deposit Receipt (FDR)",
                "Sonali Bank PLC, Motijheel Br. FDR #-----------"
              ],
              [
                "Fixed Deposit Receipt (FDR)",
                "Prime Bank PLC, Motijheel Br. FDR # #-----------"
              ],
              [
                "Fixed Deposit Receipt (FDR)",
                "Eastern Bank PLC, Motijheel Br. FDR #----------"
              ],
              [
                "Short-term Investments",
                "Treasury Bills"
              ],
              [
                "Short-term Investments",
                "Marketable Securities"
              ],
              [
                "Short-term Investments",
                "Mutual Funds"
              ],
              [
                "Short-term Investments",
                "Other Short-term Investments"
              ],
              [
                "Mobile Banking",
                "bKash"
              ],
              [
                "Mobile Banking",
                "Nagad"
              ],
              [
                "Mobile Banking",
                "Rocket"
              ]
            ]
          },
          {
            "name": "Trade & Other Receivables",
            "headPaths": [
              [
                "Trade Receivables",
                "Customer A"
              ],
              [
                "Trade Receivables",
                "Customer B"
              ],
              [
                "Trade Receivables",
                "Customer C"
              ],
              [
                "Bills Receivable"
              ],
              [
                "Employee Receivables",
                "Salary Advance"
              ],
              [
                "Employee Receivables",
                "Loan to Employees"
              ],
              [
                "Employee Receivables",
                "Travel Advance"
              ],
              [
                "Employee Receivables",
                "Director Receivables"
              ],
              [
                "Advances, Deposits & Prepayments",
                "Advance Rent"
              ],
              [
                "Advances, Deposits & Prepayments",
                "Godwan Rent"
              ],
              [
                "Advances, Deposits & Prepayments",
                "Security Deposit",
                "Utility Deposit"
              ],
              [
                "Advances, Deposits & Prepayments",
                "Security Deposit",
                "Rent Deposit"
              ],
              [
                "Advances, Deposits & Prepayments",
                "Security Deposit",
                "Supplier Deposit"
              ],
              [
                "Advances, Deposits & Prepayments",
                "Advance Income Tax (AIT)",
                "AIT – TDS (Withholding Tax)"
              ],
              [
                "Advances, Deposits & Prepayments",
                "Advance Income Tax (AIT)",
                "AIT – Bank Interest Tax"
              ],
              [
                "Advances, Deposits & Prepayments",
                "Advance Income Tax (AIT)",
                "AIT – Import Tax"
              ],
              [
                "Advances, Deposits & Prepayments",
                "Advance Income Tax (AIT)",
                "AIT – Contractor Payment TDS"
              ],
              [
                "Advances, Deposits & Prepayments",
                "Advance Income Tax (AIT)",
                "AIT – Salary TDS"
              ]
            ]
          },
          {
            "name": "Inventories",
            "headPaths": [
              [
                "Raw Materials"
              ],
              [
                "Work-in-Progress"
              ],
              [
                "Finished Goods"
              ],
              [
                "Packing Materials"
              ],
              [
                "Consumable Stores"
              ],
              [
                "Spare Parts"
              ],
              [
                "Goods in Transit"
              ]
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Capital & Liabilities",
    "type": "liability",
    "semiSubGroups": [
      {
        "name": "Equity / Capital",
        "subGroups": [
          {
            "name": "Owner's Capital",
            "headPaths": [
              [
                "Proprietor's Capital"
              ],
              [
                "Drawings (-)"
              ],
              [
                "Retained Earnings"
              ]
            ]
          },
          {
            "name": "Partners' Capital",
            "headPaths": [
              [
                "Partner A Capital"
              ],
              [
                "Partner B Capital"
              ]
            ]
          },
          {
            "name": "Partners' Current Accounts",
            "headPaths": [
              [
                "Dilip Kumar Sarkar"
              ],
              [
                "Bithi Sarkar"
              ],
              [
                "Other Partners"
              ]
            ]
          },
          {
            "name": "Share Capital",
            "headPaths": [
              [
                "Authorized Capital"
              ],
              [
                "Issued Capital"
              ],
              [
                "Paid-up Capital"
              ],
              [
                "Share Premium"
              ],
              [
                "Retained Earnings"
              ],
              [
                "Current Year Profit / Loss"
              ],
              [
                "General Reserve"
              ],
              [
                "Revaluation Reserve"
              ],
              [
                "Foreign Currency Translation Reserve"
              ]
            ]
          }
        ]
      },
      {
        "name": "Non-Current Liabilities",
        "subGroups": [
          {
            "name": "Non-Current Liabilities",
            "headPaths": [
              [
                "Long-term Bank Loans"
              ],
              [
                "Lease Liabilities"
              ],
              [
                "Deferred Tax Liabilities"
              ],
              [
                "Gratuity Obligations"
              ],
              [
                "Employee Benefit Obligations"
              ],
              [
                "Long-term Security Deposits"
              ],
              [
                "Debentures"
              ],
              [
                "Bonds Payable"
              ],
              [
                "Other Long-term Liabilities"
              ]
            ]
          }
        ]
      },
      {
        "name": "Current Liabilities",
        "subGroups": [
          {
            "name": "Short-term Borrowings",
            "headPaths": [
              [
                "Bank Overdraft"
              ],
              [
                "Cash Credit Loan"
              ],
              [
                "Working Capital Loan"
              ],
              [
                "Director's Loan"
              ],
              [
                "Related Party Loan"
              ],
              [
                "Other Short-term Borrowings"
              ]
            ]
          },
          {
            "name": "Trade & Other Payables",
            "headPaths": [
              [
                "Trade Payables",
                "Supplier - ABC Traders"
              ],
              [
                "Trade Payables",
                "Supplier - XYZ Enterprise"
              ],
              [
                "Trade Payables",
                "Supplier - M/S Rahman & Co."
              ],
              [
                "Bills Payable"
              ],
              [
                "Accrued Expenses",
                "Audit Fee Payable"
              ],
              [
                "Accrued Expenses",
                "Electricity Expense Payable"
              ],
              [
                "Accrued Expenses",
                "Rent Payable"
              ],
              [
                "Accrued Expenses",
                "Interest Payable"
              ],
              [
                "Employee Payables",
                "Salary Payable"
              ],
              [
                "Employee Payables",
                "Bonus Payable"
              ],
              [
                "Employee Payables",
                "Leave Encashment Payable"
              ],
              [
                "Tax & VAT Payables",
                "Income Tax Payable"
              ],
              [
                "Tax & VAT Payables",
                "Salary TDS Payable"
              ],
              [
                "Tax & VAT Payables",
                "VAT Payable"
              ],
              [
                "Tax & VAT Payables",
                "AIT Payable"
              ],
              [
                "Tax & VAT Payables",
                "Withholding Tax Payable"
              ],
              [
                "Other Payables",
                "Director Current Account"
              ],
              [
                "Other Payables",
                "Intercompany Payable"
              ],
              [
                "Other Payables",
                "Miscellaneous Payables"
              ]
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Income",
    "type": "income",
    "semiSubGroups": [
      {
        "name": "Operating Income",
        "subGroups": [
          {
            "name": "Operating Income",
            "headPaths": [
              [
                "Sales Revenue"
              ],
              [
                "Export Revenue"
              ],
              [
                "Service Revenue"
              ],
              [
                "Contract Revenue"
              ],
              [
                "Commission Income"
              ],
              [
                "Consultancy Income"
              ],
              [
                "Training Income"
              ],
              [
                "Subscription Income"
              ],
              [
                "Rental Income (Operating)"
              ],
              [
                "Project Revenue"
              ]
            ]
          }
        ]
      },
      {
        "name": "Other Operating Income",
        "subGroups": [
          {
            "name": "Other Operating Income",
            "headPaths": [
              [
                "Scrap Sales"
              ],
              [
                "Sale of By-products"
              ],
              [
                "Reimbursement Income"
              ],
              [
                "Late Payment Charges"
              ],
              [
                "Recovery Income"
              ],
              [
                "Membership Fees Income"
              ],
              [
                "Miscellaneous Operating Income"
              ]
            ]
          }
        ]
      },
      {
        "name": "Financial Income",
        "subGroups": [
          {
            "name": "Financial Income",
            "headPaths": [
              [
                "Interest Income"
              ],
              [
                "Bank Interest Income"
              ],
              [
                "Fixed Deposit Interest"
              ],
              [
                "Dividend Income"
              ],
              [
                "Foreign Exchange Gain"
              ],
              [
                "Investment Income"
              ],
              [
                "Unrealized Gain on Investments"
              ]
            ]
          }
        ]
      },
      {
        "name": "Non-Operating Income",
        "subGroups": [
          {
            "name": "Non-Operating Income",
            "headPaths": [
              [
                "Gain on Disposal of Assets"
              ],
              [
                "Insurance Claim Income"
              ],
              [
                "Donation Income"
              ],
              [
                "Grant Income"
              ],
              [
                "Bad Debt Recovered"
              ],
              [
                "Prior Year Income"
              ],
              [
                "Sundry Income"
              ],
              [
                "Miscellaneous Income"
              ]
            ]
          }
        ]
      },
      {
        "name": "Other Comprehensive Income",
        "subGroups": [
          {
            "name": "Other Comprehensive Income",
            "headPaths": [
              [
                "Revaluation Surplus"
              ],
              [
                "Foreign Currency Translation Gain"
              ],
              [
                "Fair Value Gain on Investments"
              ],
              [
                "Actuarial Gain"
              ]
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Expenditure",
    "type": "expense",
    "semiSubGroups": [
      {
        "name": "Cost of Goods Sold (COGS)",
        "subGroups": [
          {
            "name": "Direct Materials",
            "headPaths": [
              [
                "Purchase of Goods"
              ],
              [
                "Raw Material Purchase"
              ],
              [
                "Import Purchase"
              ],
              [
                "Import Raw Material Purchase"
              ],
              [
                "Local Purchase"
              ],
              [
                "Purchase Return (-)"
              ],
              [
                "Carriage Inward / Freight Inward"
              ],
              [
                "Loading & Unloading Expenses"
              ],
              [
                "Customs Duty"
              ],
              [
                "Clearing & Forwarding (C&F) Charges"
              ],
              [
                "Insurance on Purchase"
              ]
            ]
          },
          {
            "name": "Construction Materials",
            "headPaths": [
              [
                "Cement"
              ],
              [
                "Rod / Steel"
              ],
              [
                "Bricks"
              ],
              [
                "Sand"
              ],
              [
                "Stone Chips"
              ],
              [
                "Tiles"
              ],
              [
                "Paint"
              ],
              [
                "Electrical Materials"
              ],
              [
                "Plumbing Materials"
              ],
              [
                "Finishing Materials"
              ]
            ]
          },
          {
            "name": "Direct Labour",
            "headPaths": [
              [
                "Factory Wages"
              ],
              [
                "Production Salary"
              ],
              [
                "Overtime Wages"
              ],
              [
                "Mason"
              ],
              [
                "Carpenter"
              ],
              [
                "Electrician"
              ],
              [
                "Plumber"
              ],
              [
                "Painter"
              ],
              [
                "Helper"
              ],
              [
                "Daily Labour"
              ]
            ]
          },
          {
            "name": "Manufacturing Overheads",
            "headPaths": [
              [
                "Factory Employee Costs"
              ],
              [
                "Factory Rent"
              ],
              [
                "Factory Electricity"
              ],
              [
                "Factory Gas Expense"
              ],
              [
                "Factory Consumables"
              ],
              [
                "Factory Repairs & Maintenance"
              ],
              [
                "Depreciation – Factory Assets"
              ],
              [
                "Factory Insurance"
              ],
              [
                "Factory Safety & Security"
              ],
              [
                "Production Supplies Expense"
              ],
              [
                "Other Manufacturing Overheads"
              ],
              [
                "Subcontractor Costs"
              ],
              [
                "Project Equipment Hire"
              ],
              [
                "Site Transportation"
              ],
              [
                "Material Handling"
              ],
              [
                "Temporary Site Facilities"
              ],
              [
                "Project Consumables"
              ]
            ]
          }
        ]
      },
      {
        "name": "Cost of Services(COS)",
        "subGroups": [
          {
            "name": "Cost of Services(COS)",
            "headPaths": [
              [
                "Direct Service Salaries"
              ],
              [
                "Consultant Fees"
              ],
              [
                "Project Expenses"
              ],
              [
                "Direct Staff Benefits"
              ],
              [
                "Travel & Field Expenses"
              ],
              [
                "Software Development Direct Costs"
              ],
              [
                "Cloud & Hosting Costs"
              ],
              [
                "Project Materials"
              ],
              [
                "Outsourced Service Costs"
              ],
              [
                "Technical Support Costs"
              ],
              [
                "Direct Communication Expenses"
              ],
              [
                "Project Depreciation"
              ],
              [
                "Developer Salary"
              ],
              [
                "Project Staff Salary"
              ],
              [
                "Freelance Developer Expense"
              ],
              [
                "Cloud Hosting Cost"
              ],
              [
                "API Cost"
              ],
              [
                "Software License Expense"
              ],
              [
                "Server Expense"
              ],
              [
                "Technical Support Salary"
              ],
              [
                "Project Related Travel Expense"
              ],
              [
                "Third-party Service Charges"
              ]
            ]
          }
        ]
      },
      {
        "name": "General & Administrative Expenses (G&A)",
        "subGroups": [
          {
            "name": "General & Administrative Expenses (G&A)",
            "headPaths": [
              [
                "Printing & Stationery"
              ],
              [
                "Repair & Maintenance"
              ],
              [
                "Traveling & Conveyance"
              ],
              [
                "Telephone & Mobile Bill"
              ],
              [
                "Internet Bill"
              ],
              [
                "Postage & Courier Expenses"
              ],
              [
                "License & Renewal Fee"
              ],
              [
                "Paper & Periodicals"
              ],
              [
                "Fuel & Oil"
              ],
              [
                "Entertainment Expenses"
              ],
              [
                "Audit Fees"
              ],
              [
                "Legal & Professional Fees"
              ],
              [
                "Marketing & Advertising"
              ],
              [
                "Software & Subscription"
              ],
              [
                "Amortization"
              ],
              [
                "Depreciation"
              ],
              [
                "Sales Return"
              ],
              [
                "Miscellaneous Administrative Expenses"
              ]
            ]
          },
          {
            "name": "Salary & Employee Benefits",
            "headPaths": [
              [
                "Basic Salary"
              ],
              [
                "House Rent Allowance"
              ],
              [
                "Medical Allowance"
              ],
              [
                "Conveyance Allowance"
              ],
              [
                "Mobile Allowance"
              ],
              [
                "Food / Tiffin Allowance"
              ],
              [
                "Festival Allowance"
              ],
              [
                "Attendance Allowance"
              ],
              [
                "Transport Allowance"
              ],
              [
                "Internet Allowance"
              ],
              [
                "Utility Allowance"
              ],
              [
                "Special Allowance"
              ],
              [
                "Responsibility Allowance"
              ],
              [
                "Performance Allowance"
              ],
              [
                "Risk Allowance"
              ],
              [
                "Incentive"
              ],
              [
                "Commission"
              ],
              [
                "Leave Encashment"
              ],
              [
                "Provident Fund Contribution"
              ],
              [
                "Gratuity"
              ],
              [
                "Group Insurance"
              ],
              [
                "Employee Welfare"
              ],
              [
                "Medical Reimbursement"
              ]
            ]
          },
          {
            "name": "Utilities Expenses",
            "headPaths": [
              [
                "Electricity Bill Expenses"
              ],
              [
                "Gas Bill Expenses"
              ],
              [
                "WASA Bill Expenses"
              ]
            ]
          },
          {
            "name": "Incorporation & Formation Expenses",
            "headPaths": [
              [
                "RJSC Registration Fees"
              ],
              [
                "MOA & AOA Expenses"
              ],
              [
                "Legal Fees"
              ],
              [
                "Consultancy Fees"
              ],
              [
                "Company Seal Expenses"
              ],
              [
                "Trade License (Initial)"
              ]
            ]
          },
          {
            "name": "Pre-operating Expenses",
            "headPaths": [
              [
                "Office Rent before operation"
              ],
              [
                "Staff Training Expense"
              ],
              [
                "Pre-opening Salary"
              ],
              [
                "Trial Production Expense"
              ],
              [
                "Marketing before launch"
              ],
              [
                "Initial Utilities Expense"
              ],
              [
                "Health Program"
              ],
              [
                "Relief Program"
              ],
              [
                "Training Program"
              ],
              [
                "Livelihood Program"
              ],
              [
                "Emergency Program"
              ],
              [
                "Field Operations"
              ]
            ]
          }
        ]
      },
      {
        "name": "Financial Expenses",
        "subGroups": [
          {
            "name": "Financial Expenses",
            "headPaths": [
              [
                "Loan Interest"
              ],
              [
                "Bank Charges"
              ],
              [
                "Performance Guarantee Charges"
              ],
              [
                "Bid Bond Charges"
              ],
              [
                "Bank Guarantee Charges"
              ],
              [
                "Exchange Loss"
              ]
            ]
          }
        ]
      },
      {
        "name": "Non-Operating Expenses",
        "subGroups": [
          {
            "name": "Non-Operating Expenses",
            "headPaths": [
              [
                "Loss on Sale of Asset"
              ],
              [
                "Donation"
              ],
              [
                "Penalties"
              ]
            ]
          }
        ]
      }
    ]
  }
] as DefaultChartGroup[]
