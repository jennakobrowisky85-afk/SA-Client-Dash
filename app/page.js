import ClientOpsDashboard from "../components/ClientOpsDashboard";
import { getDashboardData } from "../lib/googleSheets";

// Refetch the sheet at most once every 5 minutes, so edits show up quickly
// without hitting the Sheets API on every single page load.
export const revalidate = 300;

export default async function Page() {
  const data = await getDashboardData();
  return <ClientOpsDashboard {...data} />;
}
