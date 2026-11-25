import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ApiDetail } from "./pages/ApiDetail";
import { Apis } from "./pages/Apis";
import { Apps } from "./pages/Apps";
import { Deployment } from "./pages/Deployment";
import { Gateway } from "./pages/Gateway";
import { Governance } from "./pages/Governance";
import { Monitoring } from "./pages/Monitoring";
import { Overview } from "./pages/Overview";
import { Portal } from "./pages/Portal";
import { PortalApi } from "./pages/PortalApi";
import { Security } from "./pages/Security";
import { useStore } from "./store";

export default function App() {
  const { state } = useStore();
  const dev = state.user.role === "Developer";
  const consoleOnly = (el: JSX.Element) => (dev ? <Navigate to="/portal" replace /> : el);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={consoleOnly(<Overview />)} />
        <Route path="apis" element={consoleOnly(<Apis />)} />
        <Route path="apis/:id" element={consoleOnly(<ApiDetail />)} />
        <Route path="gateway" element={consoleOnly(<Gateway />)} />
        <Route path="security" element={consoleOnly(<Security />)} />
        <Route path="monitoring" element={consoleOnly(<Monitoring />)} />
        <Route path="governance" element={consoleOnly(<Governance />)} />
        <Route path="deployment" element={consoleOnly(<Deployment />)} />
        <Route path="portal" element={<Portal />} />
        <Route path="portal/:id" element={<PortalApi />} />
        <Route path="apps" element={<Apps />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
