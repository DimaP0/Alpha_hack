import {
  BankOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  ShopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Layout, Menu, Space } from "antd";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth";
import { DemoBanner } from "./common";
export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const bank = user?.role === "BANK_OFFICER";
  const base = bank ? "/bank" : "/app";
  const links = bank
    ? [
        {
          key: base,
          icon: <DashboardOutlined />,
          label: <Link to={base}>Обзор</Link>,
        },
        {
          key: `${base}/applications`,
          icon: <FileTextOutlined />,
          label: <Link to={`${base}/applications`}>Заявки бизнеса</Link>,
        },
      ]
    : [
        {
          key: base,
          icon: <DashboardOutlined />,
          label: <Link to={base}>Обзор</Link>,
        },
        {
          key: `${base}/twin`,
          icon: <ExperimentOutlined />,
          label: <Link to={`${base}/twin`}>Business Twin</Link>,
        },
        {
          key: `${base}/company`,
          icon: <TeamOutlined />,
          label: <Link to={`${base}/company`}>Моя компания</Link>,
        },
        {
          key: `${base}/products`,
          icon: <ShopOutlined />,
          label: <Link to={`${base}/products`}>Продукты</Link>,
        },
        {
          key: `${base}/applications`,
          icon: <FileTextOutlined />,
          label: <Link to={`${base}/applications`}>Мои заявки</Link>,
        },
      ];
  const selected = links
    .filter(
      (l) =>
        location.pathname === l.key ||
        location.pathname.startsWith(`${l.key}/`),
    )
    .at(-1)?.key;
  return (
    <Layout className="app-layout">
      <Layout.Sider
        breakpoint="lg"
        collapsedWidth="0"
        width={236}
        className="sidebar"
      >
        <Link className="brand" to={base}>
          <div className="brand-mark">N</div>
          <div>
            ALFA BUSINESS<span>NAVIGATOR</span>
          </div>
        </Link>
        <div className="workspace-label">
          {bank ? "КАБИНЕТ БАНКА" : "КАБИНЕТ ПРЕДПРИНИМАТЕЛЯ"}
        </div>
        <Menu mode="inline" selectedKeys={[selected || base]} items={links} />
        <div className="sidebar-note">
          <BankOutlined />
          <p>
            Планируйте рост.
            <br />
            Понимайте риски.
          </p>
          <small>Сценарный цифровой двойник</small>
        </div>
      </Layout.Sider>
      <Layout>
        <header className="topbar">
          <div className="breadcrumb">
            Бизнес /{" "}
            <strong>
              {bank ? "Кредитный конвейер" : "Финансирование роста"}
            </strong>
          </div>
          <Space>
            <Avatar style={{ background: "#eee5e4", color: "#9a2529" }}>
              {user?.fullName.slice(0, 1)}
            </Avatar>
            <span className="user-name">{user?.fullName}</span>
            <Button size="small" onClick={logout}>
              Выйти
            </Button>
          </Space>
        </header>
        <DemoBanner />
        <main className="content">
          <Outlet />
        </main>
        <footer className="footer">
          ALFA BUSINESS NAVIGATOR · Демонстрационный прототип · Прогноз, не
          гарантия
        </footer>
      </Layout>
    </Layout>
  );
}
