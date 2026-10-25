import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Col, Empty, Form, Row, Space, Table, Tag } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCreditProducts } from "../api/hooks";
import { http } from "../api/http";
import type {
  Alternative,
  ApplicationInput,
  ApplicationView,
  CreditProduct,
  LoanParameters,
  Scenario,
  SimulationResponse,
} from "../api/contract-types";
import {
  ErrorNotice,
  money,
  PageTitle,
  QueryState,
  ScoreSummary,
} from "../components/common";
import { initialLoan, LoanForm } from "../components/LoanForm";
export const scenarioNames = {
  BASE: "Базовый",
  STRESS_15: "Выручка −15%",
  STRESS_30: "Выручка −30%",
};
export function TwinScenarioChart({ scenarios }: { scenarios: Scenario[] }) {
  const points = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    ...Object.fromEntries(
      scenarios.map((s) => [
        s.name,
        s.months.find((m) => m.monthIndex === i + 1)?.cashEndRub,
      ]),
    ),
  }));
  return (
    <Card title="Остаток денежных средств · 12 месяцев" className="section">
      <p className="muted">
        Прогноз, не гарантия. Расходы постоянны; база — среднее последних 3
        месяцев. Кредит направляется на инвестицию и не увеличивает начальный
        остаток.
      </p>
      <div
        role="img"
        aria-label="Три сценария: базовый, выручка минус 15%, выручка минус 30%"
        className="scenario-chart"
      >
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={points}
            margin={{ left: 10, right: 20, top: 15, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickFormatter={(v: number) => `${v} мес.`} />
            <YAxis
              tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)} млн`}
              width={72}
            />
            <Tooltip
              formatter={(v: number) => money(v)}
              labelFormatter={(v) => `Месяц ${v}`}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#ad3a3a" strokeDasharray="5 4" />
            <Line
              name={scenarioNames.BASE}
              dataKey="BASE"
              stroke="#1b8072"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              name={scenarioNames.STRESS_15}
              dataKey="STRESS_15"
              stroke="#d99b27"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              name={scenarioNames.STRESS_30}
              dataKey="STRESS_30"
              stroke="#df464c"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Row gutter={[12, 12]}>
        {scenarios.map((s) => (
          <Col xs={24} md={8} key={s.name}>
            <div className="scenario-stat">
              <strong>{scenarioNames[s.name]}</strong>
              <span>
                Минимальный остаток: <b>{money(s.minCashBalanceRub)}</b>
              </span>
              <Tag color={s.negativeCashMonths ? "red" : "green"}>
                {s.negativeCashMonths} мес. с отрицательным остатком
              </Tag>
            </div>
          </Col>
        ))}
      </Row>
      <details className="chart-data">
        <summary>Данные прогноза по месяцам</summary>
        <Table
          size="small"
          pagination={false}
          scroll={{ x: 560 }}
          rowKey="month"
          dataSource={points}
          columns={[
            { title: "Месяц", dataIndex: "month" },
            ...(["BASE", "STRESS_15", "STRESS_30"] as const).map((name) => ({
              title: scenarioNames[name],
              dataIndex: name,
              render: (v: number) => money(v),
            })),
          ]}
        />
      </details>
    </Card>
  );
}
export function AlternativeOffers({
  alternatives,
  choose,
}: {
  alternatives: Alternative[];
  choose: (a: Alternative) => void;
}) {
  return (
    <Card title="Другие варианты финансирования" className="section">
      <p className="muted">Расчётные варианты — не банковские оферты.</p>
      {alternatives.length ? (
        <Row gutter={[12, 12]}>
          {alternatives.map((a) => (
            <Col xs={24} md={8} key={`${a.requestedAmountRub}-${a.termMonths}`}>
              <div className="alternative">
                <h3>{money(a.requestedAmountRub)}</h3>
                <p>
                  {a.termMonths} мес. · {money(a.monthlyPaymentRub)} / мес.
                </p>
                <p>
                  DSCR {a.dscr.toFixed(2)} · {a.score} баллов
                </p>
                <Button block onClick={() => choose(a)}>
                  Выбрать вариант
                </Button>
              </div>
            </Col>
          ))}
        </Row>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Нет допустимых альтернатив для этих параметров"
        />
      )}
    </Card>
  );
}
function TwinWorkspace({ products }: { products: CreditProduct[] }) {
  const queryClient = useQueryClient();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [form] = Form.useForm<ApplicationInput>();
  const product =
    products.find((p) => p.id === Number(search.get("product"))) || products[0];
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController>();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const generation = useRef(0);
  useEffect(
    () => () => {
      abort.current?.abort();
      clearTimeout(timer.current);
    },
    [],
  );
  const simulate = async () => {
    const current = ++generation.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setResult(null);
    setError(null);
    try {
      const values = await form.validateFields();
      if (current !== generation.current) return;
      const { purpose: _purpose, ...parameters } = values;
      void _purpose;
      setBusy(true);
      const response = await http<SimulationResponse>("/simulations", {
        method: "POST",
        body: parameters satisfies LoanParameters,
        signal: controller.signal,
      });
      if (current === generation.current) setResult(response);
    } catch (e) {
      if (
        current === generation.current &&
        e instanceof Error &&
        e.name !== "AbortError"
      )
        setError(e);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  const changed = () => {
    generation.current++;
    abort.current?.abort();
    clearTimeout(timer.current);
    setResult(null);
    setError(null);
    setBusy(false);
    timer.current = setTimeout(() => void simulate(), 300);
  };
  const create = useMutation({
    mutationFn: (body: ApplicationInput) =>
      http<ApplicationView>("/applications", { method: "POST", body }),
    onSuccess: (app) => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      navigate(`/app/applications/${app.id}`);
    },
  });
  return (
    <>
      <Row gutter={[24, 24]}>
        <Col xs={24} xl={9}>
          <Card title="Параметры вашего плана">
            <LoanForm
              form={form}
              products={products}
              initialValues={initialLoan(product)}
              onChange={changed}
              onFinish={() => void simulate()}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  loading={busy}
                >
                  Рассчитать сценарии
                </Button>
                <Button
                  block
                  disabled={!result || busy}
                  loading={create.isPending}
                  onClick={() =>
                    void form
                      .validateFields()
                      .then((v) => create.mutate(v))
                      .catch(() => undefined)
                  }
                >
                  Подать заявку с выбранными параметрами
                </Button>
              </Space>
            </LoanForm>
            <ErrorNotice error={create.error} />
          </Card>
        </Col>
        <Col xs={24} xl={15}>
          <ErrorNotice error={error} retry={() => void simulate()} />
          {busy && <Card loading title="Рассчитываем сценарии" />}
          {result ? (
            <ScoreSummary score={result} />
          ) : (
            !busy && (
              <div className="twin-empty">
                <div className="orbit">↗</div>
                <h2>Сначала посмотрите вперёд</h2>
                <p>
                  Задайте параметры и рассчитайте, как кредит повлияет на
                  денежный поток вашего бизнеса.
                </p>
                <div className="pill-row">
                  <span>Базовый сценарий</span>
                  <span>Стресс −15%</span>
                  <span>Стресс −30%</span>
                </div>
              </div>
            )
          )}
        </Col>
      </Row>
      {result && (
        <>
          <TwinScenarioChart scenarios={result.scenarios} />
          <AlternativeOffers
            alternatives={result.alternatives}
            choose={(a) => {
              form.setFieldsValue({
                requestedAmountRub: a.requestedAmountRub,
                termMonths: a.termMonths,
              });
              changed();
            }}
          />
        </>
      )}
    </>
  );
}
export function TwinPage() {
  const query = useCreditProducts();
  return (
    <>
      <PageTitle eyebrow="BUSINESS TWIN" title="Проверьте план на прочность">
        Ваш бизнес в трёх сценариях. Меняйте параметры, сравнивайте запас
        прочности и принимайте взвешенные решения.
      </PageTitle>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {query.data?.length ? (
          <TwinWorkspace products={query.data} />
        ) : (
          <Empty description="Нет доступных кредитных продуктов" />
        )}
      </QueryState>
    </>
  );
}
