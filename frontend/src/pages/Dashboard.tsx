import { Button, Card, Col, Empty, Row, Statistic } from "antd";
import { Link } from "react-router-dom";
import {
  useApplications,
  useBankApplications,
  useCompany,
  useCreditProducts,
} from "../api/hooks";
import {
  money,
  PageTitle,
  QueryState,
  statusLabels,
} from "../components/common";
import type { CreditProduct, Status } from "../api/contract-types";
import { ApplicationsTable } from "./Applications";
export function ProductsGrid({ products }: { products: CreditProduct[] }) {
  return (
    <Row gutter={[20, 20]}>
      {products.map((product, i) => (
        <Col xs={24} lg={12} key={product.id}>
          <Card className="product-card">
            <div className="product-index">0{i + 1} / ФИНАНСИРОВАНИЕ</div>
            <h2>{product.name}</h2>
            <div className="product-rate">
              {product.annualRatePct}
              <span>% годовых</span>
            </div>
            <p>
              {money(product.minAmountRub)} — {money(product.maxAmountRub)}
            </p>
            <p className="muted">
              Сроки: {product.allowedTermsMonths.join(" / ")} мес.
            </p>
            <Link to={`/app/twin?product=${product.id}`}>
              <Button type="primary">Проверить в Business Twin →</Button>
            </Link>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
export function ProductsPage() {
  const query = useCreditProducts();
  return (
    <>
      <PageTitle
        eyebrow="ВОЗМОЖНОСТИ ДЛЯ РОСТА"
        title="Подберите финансирование"
      >
        Сначала сравните условия, затем проверьте их влияние на денежный поток.
      </PageTitle>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {query.data?.length ? (
          <ProductsGrid products={query.data} />
        ) : (
          <Empty description="Продукты не найдены" />
        )}
      </QueryState>
    </>
  );
}
export function Dashboard() {
  const company = useCompany();
  const apps = useApplications();
  return (
    <>
      <PageTitle
        eyebrow="ВАШ БИЗНЕС СЕГОДНЯ"
        title={company.data?.name || "Обзор бизнеса"}
      >
        Всё, что нужно для следующего финансового решения.
      </PageTitle>
      <div className="hero-card">
        <div>
          <div className="eyebrow">СЦЕНАРНЫЙ ЦИФРОВОЙ ДВОЙНИК</div>
          <h2>
            Рост начинается
            <br />с понятного плана.
          </h2>
          <p>
            Узнайте, какой платёж выдержит ваш бизнес,
            <br />
            даже если выручка снизится.
          </p>
          <Link to="/app/twin">
            <Button size="large" type="primary">
              Открыть Business Twin →
            </Button>
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span>12</span>
          <small>месяцев вперёд</small>
        </div>
      </div>
      <QueryState
        loading={company.isPending}
        error={company.error}
        retry={() => void company.refetch()}
      >
        {company.data && (
          <Row gutter={[16, 16]} className="section">
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="Денежный остаток"
                  value={company.data.cashBalanceRub}
                  suffix="₽"
                  groupSeparator=" "
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="Текущие платежи по долгам"
                  value={company.data.existingDebtMonthlyRub}
                  suffix="₽ / мес."
                  groupSeparator=" "
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="Срок работы компании"
                  value={company.data.operatingMonths}
                  suffix="мес."
                />
              </Card>
            </Col>
          </Row>
        )}
      </QueryState>
      <Card
        title="Последние заявки"
        className="section"
        extra={<Link to="/app/applications">Все заявки →</Link>}
      >
        <QueryState
          loading={apps.isPending}
          error={apps.error}
          retry={() => void apps.refetch()}
        >
          <ApplicationsTable applications={(apps.data || []).slice(0, 5)} />
        </QueryState>
      </Card>
    </>
  );
}
export function BankDashboard() {
  const query = useBankApplications();
  const statuses: Status[] = [
    "UNDER_REVIEW",
    "NEEDS_INFO",
    "OFFERED",
    "ACCEPTED",
  ];
  return (
    <>
      <PageTitle
        eyebrow="КАБИНЕТ СОТРУДНИКА БАНКА"
        title="Решения, подкреплённые данными"
      >
        Рассматривайте заявки, изучайте причины оценки и выбирайте условия.
      </PageTitle>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        <Row gutter={[16, 16]}>
          {statuses.map((status) => (
            <Col xs={12} lg={6} key={status}>
              <Card>
                <Statistic
                  title={statusLabels[status]}
                  value={
                    query.data?.filter((app) => app.status === status).length ||
                    0
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
        <Card
          className="section"
          title={`Все заявки · ${query.data?.length || 0}`}
          extra={<Link to="/bank/applications">Перейти к списку →</Link>}
        >
          <ApplicationsTable bank applications={query.data || []} />
        </Card>
      </QueryState>
    </>
  );
}
