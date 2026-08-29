import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { useUIStore } from "@/stores/ui.store";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const COLORS = {
  navy: "#101A30",
  amber: "#E8A93B",
  amberLight: "rgba(232, 169, 59, 0.15)",
  success: "#2E7D5B",
  successLight: "rgba(46, 125, 91, 0.15)",
  danger: "#C1432E",
  dangerLight: "rgba(193, 67, 46, 0.15)",
  steel: "#66707E",
  info: "#0284C7",
  infoLight: "rgba(2, 132, 199, 0.15)",
  palette: [
    "#0284C7",
    "#E8A93B",
    "#2E7D5B",
    "#C1432E",
    "#66707E",
    "#8B5CF6",
    "#EC4899",
    "#14B8A6",
  ],
};

interface BaseProps {
  labels?: string[];
  data?: number[];
  title?: string;
}

const useTheme = () => {
  const isDark = useUIStore((s) => s.theme === "dark");
  const textColor = isDark ? "#9BA3B0" : "#66707E";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  return { isDark, textColor, gridColor };
};

const fmtMga = (v: number) => `${(v / 1000000).toFixed(0)}M`;

export function SaasTenantsGrowthChart({
  labels = [],
  data = [],
}: {
  labels?: string[];
  data?: number[];
}) {
  const { textColor, gridColor } = useTheme();

  const chartData = {
    labels,
    datasets: [
      {
        label: "Tenants (entreprises)",
        data,
        borderColor: COLORS.danger,
        backgroundColor: COLORS.dangerLight,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: labels.length
          ? "Évolution des Abonnements SaaS (Tenants)"
          : "Données indisponibles",
        color: textColor,
        font: { weight: "bold" as const },
      },
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: textColor } },
      y: { grid: { color: gridColor }, ticks: { color: textColor } },
    },
  };

  return <Line data={chartData} options={options} />;
}

export function UserActivityLogsChart({ labels = [], data = [] }: BaseProps) {
  const { textColor, gridColor } = useTheme();

  const chartData = {
    labels,
    datasets: [
      {
        label: "Connexions Utilisateurs",
        data,
        backgroundColor: COLORS.info,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: labels.length
          ? "Activité des Utilisateurs (Connexions/Jour)"
          : "Données indisponibles",
        color: textColor,
        font: { weight: "bold" as const },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor } },
      y: { grid: { color: gridColor }, ticks: { color: textColor } },
    },
  };

  return <Bar data={chartData} options={options} />;
}

export function CaVsDepensesChart({
  labels = [],
  ca = [],
  depenses = [],
}: {
  labels?: string[];
  ca?: number[];
  depenses?: number[];
}) {
  const { textColor, gridColor } = useTheme();

  const chartData = {
    labels,
    datasets: [
      {
        label: "Chiffre d'Affaires (MGA)",
        data: ca,
        borderColor: COLORS.success,
        backgroundColor: COLORS.successLight,
        fill: true,
        tension: 0.3,
      },
      {
        label: "Dépenses Totales (MGA)",
        data: depenses,
        borderColor: COLORS.danger,
        backgroundColor: COLORS.dangerLight,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { color: textColor } },
      title: {
        display: true,
        text: labels.length
          ? "Comparatif CA vs Dépenses Globale (MGA)"
          : "Données indisponibles",
        color: textColor,
        font: { weight: "bold" as const },
      },
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: textColor } },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, callback: (v: number) => fmtMga(v) },
      },
    },
  };

  return <Line data={chartData} options={options} />;
}

export function DepensesParPosteChart({ labels = [], data = [] }: BaseProps) {
  const { textColor } = useTheme();

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: COLORS.palette,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { color: textColor } },
      title: {
        display: true,
        text: labels.length
          ? "Répartition des Dépenses Comptables (MGA)"
          : "Données indisponibles",
        color: textColor,
        font: { weight: "bold" as const },
      },
    },
  };

  return <Doughnut data={chartData} options={options} />;
}

export function MultiChantiersProgressChart({
  labels = [],
  avancement = [],
  consommation = [],
}: {
  labels?: string[];
  avancement?: number[];
  consommation?: number[];
}) {
  const { textColor, gridColor } = useTheme();

  const chartData = {
    labels,
    datasets: [
      {
        label: "Avancement Physique (%)",
        data: avancement,
        backgroundColor: COLORS.info,
        borderRadius: 6,
      },
      {
        label: "Consommation Budget (%)",
        data: consommation,
        backgroundColor: COLORS.amber,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { color: textColor } },
      title: {
        display: true,
        text: labels.length
          ? "Avancement Physique vs Consommation Budgétaire (%)"
          : "Données indisponibles",
        color: textColor,
        font: { weight: "bold" as const },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor } },
      y: { grid: { color: gridColor }, ticks: { color: textColor, max: 100 } },
    },
  };

  return <Bar data={chartData} options={options} />;
}

export function EquipePresenceDailyChart({
  labels = [],
  data = [],
}: BaseProps) {
  const { textColor, gridColor } = useTheme();

  const chartData = {
    labels,
    datasets: [
      {
        label: "Présence Ouvriers (Personnes)",
        data,
        backgroundColor: COLORS.success,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: labels.length
          ? "Présence Quotidienne de l'Équipe sur le Site"
          : "Données indisponibles",
        color: textColor,
        font: { weight: "bold" as const },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor } },
      y: { grid: { color: gridColor }, ticks: { color: textColor } },
    },
  };

  return <Bar data={chartData} options={options} />;
}

export function RhEquipesDistributionChart({
  labels = [],
  data = [],
}: BaseProps) {
  const { textColor } = useTheme();

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: COLORS.palette,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { color: textColor } },
      title: {
        display: true,
        text: labels.length
          ? "Répartition de l'Effectif par Corps de Métier"
          : "Données indisponibles",
        color: textColor,
        font: { weight: "bold" as const },
      },
    },
  };

  return <Doughnut data={chartData} options={options} />;
}

export function ParcUsageRateChart({ labels = [], data = [] }: BaseProps) {
  const { textColor, gridColor } = useTheme();

  const chartData = {
    labels,
    datasets: [
      {
        label: "Taux d'Utilisation (%)",
        data,
        backgroundColor: COLORS.amber,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: labels.length
          ? "Taux d'Utilisation du Parc Matériel (%)"
          : "Données indisponibles",
        color: textColor,
        font: { weight: "bold" as const },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor } },
      y: { grid: { color: gridColor }, ticks: { color: textColor, max: 100 } },
    },
  };

  return <Bar data={chartData} options={options} />;
}

export function StockCategoryDistributionChart({
  labels = [],
  data = [],
}: BaseProps) {
  const { textColor } = useTheme();

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: COLORS.palette,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { color: textColor } },
      title: {
        display: true,
        text: labels.length
          ? "Répartition des Références en Stock (Qté)"
          : "Données indisponibles",
        color: textColor,
        font: { weight: "bold" as const },
      },
    },
  };

  return <Doughnut data={chartData} options={options} />;
}

export function SalesPipelineChart({ labels = [], data = [] }: BaseProps) {
  const { textColor, gridColor } = useTheme();

  const chartData = {
    labels,
    datasets: [
      {
        label: "Montant Pipeline (MGA)",
        data,
        backgroundColor: COLORS.palette,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: labels.length
          ? "Pipeline Commercial par Étape (MGA)"
          : "Données indisponibles",
        color: textColor,
        font: { weight: "bold" as const },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor } },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, callback: (v: number) => fmtMga(v) },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}

export function WorkerPersonalAttendanceChart() {
  return (
    <div className="w-100 h-100 d-flex align-items-center justify-content-center py-4">
      <p className="text-muted mb-0 fst-italic">
        Pas de source de données temps réel pour votre pointage personnel.
      </p>
    </div>
  );
}
