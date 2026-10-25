import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  InputNumber,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import { ApiError } from "../api/http";
import type {
  RiskFactor,
  Scoring,
  SimulationResponse,
  Status,
  StatusHistory,
} from "../api/contract-types";
export const money = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
export const date = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const statusLabels: Record<Status, string> = {
  DRAFT: "Черновик",
  CHECKING: "Проверяется",
  NEEDS_INFO: "Нужны сведения",
  UNDER_REVIEW: "На рассмотрении",
  OFFERED: "Предложение банка",
  DECLINED: "Отказ",
  ACCEPTED: "Условия приняты",
  SIMULATED_ISSUED: "Выдача имитирована",
};
export const recommendationLabels = {
  APPROVE: "Рекомендовано одобрение",
  MANUAL_REVIEW: "Нужна ручная проверка",
  DECLINE: "Рекомендован отказ",
};
export function DemoBanner() {
  return (
    <div className="demo-banner">
      Демо-прототип • Только синтетические данные{" "}
      <span>Не является предложением банка</span>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <Typography.Title level={1}>{title}</Typography.Title>
      {children && (
        <Typography.Paragraph type="secondary">{children}</Typography.Paragraph>
      )}
    </div>
  );
}
export function StatusBadge({ status }: { status: Status }) {
  return (
    <Tag
      color={
        {
          DRAFT: "default",
          CHECKING: "processing",
          NEEDS_INFO: "warning",
          UNDER_REVIEW: "blue",
          OFFERED: "green",
          DECLINED: "error",
          ACCEPTED: "cyan",
          SIMULATED_ISSUED: "purple",
        }[status]
      }
    >
      {statusLabels[status]}
    </Tag>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  if (!error) return null;
  const status = error instanceof ApiError ? error.status : 0;
  const titles: Record<number, string> = {
    400: "Проверьте введённые данные",
    401: "Не удалось войти",
    403: "Нет доступа к этим данным",
    404: "Запись не найдена",
    409: "Состояние заявки изменилось. Обновите данные.",
    422: "Некорректные параметры",
    503: "Расчёт временно недоступен. Результат не получен.",
  };
  const details =
    error instanceof ApiError ? Object.entries(error.details) : [];
  return (
    <Alert
      className="notice"
      type="error"
      showIcon
      message={titles[status] || "Не удалось выполнить действие"}
      description={
        <>
          {error.message}
          {details.length > 0 && (
            <ul>
              {details.map(([field, value]) => (
                <li key={field}>
                  {field}: {String(value)}
                </li>
              ))}
            </ul>
          )}
        </>
      }
      action={
        retry ? (
          <Button size="small" onClick={retry}>
            Повторить
          </Button>
        ) : undefined
      }
    />
  );
}
export function QueryState({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: Error | null;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading)
    return (
      <Card>
        <Skeleton active />
      </Card>
    );
  if (error) return <ErrorNotice error={error} retry={retry} />;
  return <>{children}</>;
}
export function MoneyField(
  props: React.ComponentProps<typeof InputNumber<number>>,
) {
  return (
    <InputNumber<number>
      min={0}
      precision={0}
      step={10000}
      addonAfter="₽"
      style={{ width: "100%" }}
      {...props}
    />
  );
}
export function RiskFactors({ factors }: { factors: RiskFactor[] }) {
  return (
    <div className="factors">
      {factors.length ? (
        factors.map((factor) => (
          <div className="factor" key={factor.code}>
            <span>{factor.message}</span>
            <Tag color={factor.impactPoints < 0 ? "orange" : "green"}>
              {factor.impactPoints > 0 ? "+" : ""}
              {factor.impactPoints} баллов
            </Tag>
          </div>
        ))
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Факторы не переданы"
        />
      )}
    </div>
  );
}
export function ScoreSummary({
  score,
}: {
  score: Scoring | SimulationResponse;
}) {
  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Ежемесячный платёж"
              value={score.monthlyPaymentRub}
              suffix="₽"
              groupSeparator=" "
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic
              title="DSCR · покрытие долга"
              value={score.dscr}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic
              title="Демо-оценка"
              value={score.score}
              suffix="/ 1000"
            />
          </Card>
        </Col>
      </Row>
      <Card title="Почему такая оценка" className="section">
        <Space wrap>
          <Tag
            color={
              score.riskLevel === "LOW"
                ? "green"
                : score.riskLevel === "HIGH"
                  ? "red"
                  : "orange"
            }
          >
            Риск:{" "}
            {
              { LOW: "низкий", MEDIUM: "средний", HIGH: "высокий" }[
                score.riskLevel
              ]
            }
          </Tag>
          <span>
            Рекомендация алгоритма: {recommendationLabels[score.recommendation]}
          </span>
        </Space>
        <p className="muted">
          Условная демонстрационная оценка. Решение принимает сотрудник банка.
          DSCR сравнивает операционный доход с ежемесячными платежами и не
          учитывает ожидаемый рост выручки.
        </p>
        <RiskFactors factors={score.factors} />
      </Card>
    </>
  );
}
export function ApplicationTimeline({ history }: { history: StatusHistory[] }) {
  return (
    <Timeline
      items={history.map((item, i) => ({
        key: i,
        children: (
          <>
            <strong>
              {statusLabels[item.toStatus as Status] || item.toStatus}
            </strong>
            <div className="muted">
              {date(item.changedAt)} ·{" "}
              {item.actorRole === "BANK_OFFICER"
                ? "Сотрудник банка"
                : item.actorRole === "ENTREPRENEUR"
                  ? "Предприниматель"
                  : "Система"}
            </div>
            {item.comment && <div>{item.comment}</div>}
          </>
        ),
      }))}
    />
  );
}
