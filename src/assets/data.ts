// Типизация главного объекта DashboardData
export interface DashboardData {
    kpi: KPI;
    chartData: ChartDataPoint[];
    transactions: Transaction[];
    goals: Goal[];
}

// Типизация для KPI (ключевых показателей)
export interface KPI {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
}

// Типизация для данных графика (динамика баланса)
export interface ChartDataPoint {
    date: string;    // формата "YYYY-MM-DD"
    balance: number;
}

// Типизация для транзакций
export interface Transaction {
    id: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
    date: string;    // формат ISO или "YYYY-MM-DD"
    description: string;
}

// Типизация для целей
export interface Goal {
    id: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string; // формат "YYYY-MM-DD", может быть опциональным, если не задан
    category: string;
}



export const balance:DashboardData[] = [
    {
        "kpi": {
            "totalIncome": 5000,
            "totalExpenses": 3200,
            "balance": 1800
        },
        "chartData": [
            { "date": "2025-03-01", "balance": 5000 },
            { "date": "2025-03-02", "balance": 3800 },
            { "date": "2025-03-04", "balance": 3500 },
            { "date": "2025-03-05", "balance": 4300 },
            { "date": "2025-03-06", "balance": 4200 }
        ],
        "transactions": [
            {
                "id": "t1",
                "type": "income",
                "category": "Salary",
                "amount": 5000,
                "date": "2025-03-01",
                "description": "Monthly salary"
            },
            {
                "id": "t2",
                "type": "expense",
                "category": "Rent",
                "amount": 1200,
                "date": "2025-03-02",
                "description": "Apartment rent"
            },
            {
                "id": "t3",
                "type": "expense",
                "category": "Food",
                "amount": 300,
                "date": "2025-03-04",
                "description": "Groceries"
            },
            {
                "id": "t4",
                "type": "income",
                "category": "Freelance",
                "amount": 800,
                "date": "2025-03-05",
                "description": "Side project"
            },
            {
                "id": "t5",
                "type": "expense",
                "category": "Transport",
                "amount": 100,
                "date": "2025-03-06",
                "description": "Metro pass"
            }
        ],
        "goals": [
            {
                "id": "g1",
                "title": "Vacation",
                "targetAmount": 3000,
                "currentAmount": 1800,
                "deadline": "2025-08-15",
                "category": "Travel"
            },
            {
                "id": "g2",
                "title": "MacBook Pro",
                "targetAmount": 2500,
                "currentAmount": 1000,
                "deadline": "2025-06-01",
                "category": "Tech"
            }
        ]
    }
]