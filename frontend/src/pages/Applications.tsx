import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
} from "antd";
import { Link, useParams } from "react-router-dom";
import {
  useApplication,
  useApplications,
  useBankApplications,
  useCreditProducts,
} from "../api/hooks";
import { http } from "../api/http";
import type {
  ApplicationInput,
  ApplicationView,
  BankDecisionRequest,
  CreditProduct,
  Status,
} from "../api/contract-types";
import {
  ApplicationTimeline,
  date,
  ErrorNotice,
  money,
  MoneyField,
  PageTitle,
  QueryState,
  recommendationLabels,
  ScoreSummary,
  StatusBadge,
  statusLabels,
} from "../components/common";
import { LoanForm } from "../components/LoanForm";
import { useAuth } from "../features/auth";
export function ApplicationsTable({
  applications,
  bank = false,
}: {
  applications: ApplicationView[];
  bank?: boolean;
}) {
  return (
    <Table<ApplicationView>
      rowKey="id"
      dataSource={applications}
      scroll={{ x: 760 }}
      locale={{ emptyText: <Empty description="Заявок пока нет" /> }}
      pagination={{ pageSize: 10, hideOnSinglePage: true }}
      columns={[
        {
          title: "Заявка / компания",
          key: "id",
          render: (_, app) => (
            <Link to={`${bank ? "/bank" : "/app"}/applications/${app.id}`}>
              <strong>№ {app.id}</strong>
              <div>{app.companyName}</div>
            </Link>
          ),
        },
        { title: "Сумма", dataIndex: "requestedAmountRub", render: money },
        { title: "Создана", dataIndex: "createdAt", render: date },
        {
          title: "Статус",
          dataIndex: "status",
          render: (value: Status) => <StatusBadge status={value} />,
        },
        {
          title: "Рекомендация алгоритма",
          key: "score",
          render: (_, app) =>
            app.scoring
              ? recommendationLabels[app.scoring.recommendation]
              : "Ещё нет оценки",
        },
      ]}
    />
  );
}
function OwnerList() {
  const query = useApplications();
  return (
    <QueryState
      loading={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
    >
      <Card>
        <ApplicationsTable applications={query.data || []} />
      </Card>
    </QueryState>
  );
}
function BankList() {
  const [status, setStatus] = useState<Status>();
  const query = useBankApplications(status);
  return (
    <>
      <Select
        aria-label="Фильтр по статусу"
        className="section-bottom"
        style={{ minWidth: 250 }}
        allowClear
        placeholder="Все статусы"
        value={status}
        onChange={setStatus}
        options={Object.entries(statusLabels).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        <Card>
          <ApplicationsTable bank applications={query.data || []} />
        </Card>
      </QueryState>
    </>
  );
}
export function ApplicationsPage() {
  const bank = useAuth().user?.role === "BANK_OFFICER";
  return (
    <>
      <PageTitle
        eyebrow={bank ? "КРЕДИТНЫЙ КОНВЕЙЕР" : "ФИНАНСИРОВАНИЕ"}
        title={bank ? "Заявки бизнеса" : "Мои заявки"}
      >
        Статусы и решения обновляются из системы банка.
      </PageTitle>
      {!bank && (
        <Link to="/app/twin">
          <Button type="primary" className="section-bottom">
            Новая заявка
          </Button>
        </Link>
      )}
      {bank ? <BankList /> : <OwnerList />}
    </>
  );
}
export function DecisionPanel({
  application,
  product,
  onDone,
}: {
  application: ApplicationView;
  product: CreditProduct;
  onDone: () => void;
}) {
  const [form] = Form.useForm<BankDecisionRequest>();
  const decision = Form.useWatch("decision", form) as
    | BankDecisionRequest["decision"]
    | undefined;
  const mutation = useMutation({
    mutationFn: (value: BankDecisionRequest) =>
      http<ApplicationView>(`/bank/applications/${application.id}/decision`, {
        method: "POST",
        body:
          value.decision === "APPROVE"
            ? {
                decision: value.decision,
                comment: value.comment.trim(),
                offeredAmountRub: value.offeredAmountRub,
                offeredTermMonths: value.offeredTermMonths,
              }
            : { decision: value.decision, comment: value.comment.trim() },
      }),
    onSuccess: onDone,
    onError: onDone,
  });
  return (
    <Card title="Решение сотрудника банка" className="section">
      <p className="muted">
        Скоринг помогает оценить риск. Итоговое решение в демо принимаете вы.
      </p>
      <ErrorNotice error={mutation.error} retry={onDone} />
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          decision: "APPROVE",
          offeredAmountRub: application.requestedAmountRub,
          offeredTermMonths: application.termMonths,
        }}
        onFinish={(value) => mutation.mutate(value)}
      >
        <Form.Item name="decision" label="Решение" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "APPROVE", label: "Одобрить и предложить условия" },
              { value: "DECLINE", label: "Отказать" },
              { value: "REQUEST_INFO", label: "Запросить сведения" },
            ]}
          />
        </Form.Item>
        {(decision || "APPROVE") === "APPROVE" && (
          <div className="form-grid">
            <Form.Item
              name="offeredAmountRub"
              label="Сумма предложения"
              rules={[
                {
                  required: true,
                  type: "integer",
                  min: product.minAmountRub,
                  max: Math.min(
                    application.requestedAmountRub,
                    product.maxAmountRub,
                  ),
                  message:
                    "Сумма должна соответствовать продукту и не превышать запрошенную",
                },
              ]}
            >
              <MoneyField
                min={product.minAmountRub}
                max={Math.min(
                  application.requestedAmountRub,
                  product.maxAmountRub,
                )}
              />
            </Form.Item>
            <Form.Item
              name="offeredTermMonths"
              label="Срок предложения"
              rules={[{ required: true }]}
            >
              <Select
                options={product.allowedTermsMonths.map((v) => ({
                  value: v,
                  label: `${v} месяцев`,
                }))}
              />
            </Form.Item>
          </div>
        )}
        <p>
          Ставка из продукта: <strong>{product.annualRatePct}% годовых</strong>
        </p>
        <Form.Item
          name="comment"
          label="Комментарий к решению"
          rules={[
            { required: true, whitespace: true, message: "Объясните решение" },
          ]}
        >
          <Input.TextArea rows={3} maxLength={4000} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={mutation.isPending}>
          Сохранить решение
        </Button>
      </Form>
    </Card>
  );
}
function EditApplication({
  application,
  products,
  onDone,
}: {
  application: ApplicationView;
  products: CreditProduct[];
  onDone: () => void;
}) {
  const [form] = Form.useForm<ApplicationInput>();
  const mutation = useMutation({
    mutationFn: (body: ApplicationInput) =>
      http<ApplicationView>(`/applications/${application.id}`, {
        method: "PUT",
        body,
      }),
    onSuccess: onDone,
  });
  const initial: ApplicationInput = {
    productId: application.productId,
    requestedAmountRub: application.requestedAmountRub,
    termMonths: application.termMonths,
    purpose: application.purpose,
    projectedRevenueUpliftMonthlyRub:
      application.projectedRevenueUpliftMonthlyRub,
    upliftStartMonth: application.upliftStartMonth,
  };
  return (
    <Card title="Изменить параметры заявки" className="section">
      <ErrorNotice error={mutation.error} />
      {mutation.isSuccess && (
        <Alert
          className="notice"
          message="Параметры сохранены"
          type="success"
        />
      )}
      <LoanForm
        form={form}
        products={products}
        initialValues={initial}
        onFinish={(value) => mutation.mutate(value)}
      >
        <Button htmlType="submit" loading={mutation.isPending}>
          Сохранить параметры заявки
        </Button>
      </LoanForm>
    </Card>
  );
}
function ApplicationDetails({
  application,
  refresh,
}: {
  application: ApplicationView;
  refresh: () => void;
}) {
  const bank = useAuth().user?.role === "BANK_OFFICER";
  const products = useCreditProducts();
  const client = useQueryClient();
  const done = () => {
    refresh();
    void client.invalidateQueries({ queryKey: ["applications"] });
  };
  const action = useMutation({
    mutationFn: (name: string) =>
      http<ApplicationView>(
        `${name === "simulate-disbursement" ? "/bank" : ""}/applications/${application.id}/${name}`,
        { method: "POST" },
      ),
    onSuccess: done,
    onError: done,
  });
  const product = products.data?.find((p) => p.id === application.productId);
  return (
    <>
      <div className="detail-heading">
        <PageTitle
          eyebrow={application.companyName}
          title={`Заявка № ${application.id}`}
        >
          Создана {date(application.createdAt)} · Синтетический ИНН{" "}
          {application.companyInn}
        </PageTitle>
        <StatusBadge status={application.status} />
      </div>
      <ErrorNotice error={action.error} retry={refresh} />
      <Space wrap className="section-bottom">
        <Button onClick={refresh}>Обновить данные</Button>
        {!bank &&
          (application.status === "DRAFT" ||
            application.status === "CHECKING") && (
            <Button
              type="primary"
              loading={action.isPending}
              onClick={() => action.mutate("submit")}
            >
              {application.status === "CHECKING"
                ? "Повторить проверку"
                : "Отправить на рассмотрение"}
            </Button>
          )}
        {!bank && application.status === "NEEDS_INFO" && (
          <>
            <Link to="/app/company">
              <Button>Уточнить финансовые данные</Button>
            </Link>
            <Button
              type="primary"
              loading={action.isPending}
              onClick={() => action.mutate("resubmit")}
            >
              Отправить повторно
            </Button>
          </>
        )}
        {bank && application.status === "ACCEPTED" && (
          <Button
            type="primary"
            loading={action.isPending}
            onClick={() => action.mutate("simulate-disbursement")}
          >
            Имитировать выдачу
          </Button>
        )}
      </Space>
      {application.statusComment && (
        <Alert
          className="notice"
          type={application.status === "DECLINED" ? "error" : "info"}
          showIcon
          message="Комментарий по заявке"
          description={application.statusComment}
        />
      )}
      {application.status === "CHECKING" && (
        <Alert
          className="notice"
          type="warning"
          message="Проверка ещё не завершена"
          description="При недоступности расчётного сервиса оценка не создаётся. Предприниматель может повторить проверку."
        />
      )}
      {application.status === "NEEDS_INFO" && (
        <Alert
          className="notice"
          type="warning"
          message="Нужны дополнительные сведения"
          description="Уточните финансовую историю или параметры заявки, сохраните изменения и отправьте заявку повторно."
        />
      )}
      {application.status === "SIMULATED_ISSUED" && (
        <Alert
          className="notice"
          type="success"
          message="Выдача имитирована"
          description="Деньги не переводились. Это завершение демонстрационного процесса."
        />
      )}
      <Card className="section-bottom">
        <Descriptions
          title="Параметры финансирования"
          items={[
            {
              key: "amount",
              label: "Сумма",
              children: money(application.requestedAmountRub),
            },
            {
              key: "term",
              label: "Срок",
              children: `${application.termMonths} мес.`,
            },
            {
              key: "purpose",
              label: "Цель",
              children: {
                EQUIPMENT: "Оборудование",
                WORKING_CAPITAL: "Оборотные средства",
                EXPANSION: "Расширение",
              }[application.purpose],
            },
            {
              key: "uplift",
              label: "Гипотеза роста выручки",
              children: `${money(application.projectedRevenueUpliftMonthlyRub)} / мес. с месяца ${application.upliftStartMonth}`,
            },
          ]}
        />
      </Card>
      {application.scoring ? (
        <ScoreSummary score={application.scoring} />
      ) : (
        <Card>
          <Empty
            description="Скоринг появится после успешной проверки"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
      {application.offer && (
        <Card
          className="section offer-card"
          title="Условия, предложенные сотрудником банка"
        >
          <Descriptions
            items={[
              {
                key: "amount",
                label: "Сумма",
                children: money(application.offer.amountRub),
              },
              {
                key: "term",
                label: "Срок",
                children: `${application.offer.termMonths} мес.`,
              },
              {
                key: "rate",
                label: "Ставка",
                children: `${application.offer.annualRatePct}% годовых`,
              },
            ]}
          />
          <p>{application.offer.comment}</p>
          <p className="muted">
            Демонстрационные условия. Не является реальным предложением банка.
          </p>
          {!bank && application.status === "OFFERED" && (
            <Button
              type="primary"
              loading={action.isPending}
              onClick={() => action.mutate("accept-offer")}
            >
              Принять условия
            </Button>
          )}
        </Card>
      )}
      {!bank && ["DRAFT", "NEEDS_INFO"].includes(application.status) && (
        <QueryState
          loading={products.isPending}
          error={products.error}
          retry={() => void products.refetch()}
        >
          {products.data?.length ? (
            <EditApplication
              application={application}
              products={products.data}
              onDone={done}
            />
          ) : null}
        </QueryState>
      )}
      {bank && application.status === "UNDER_REVIEW" && (
        <QueryState
          loading={products.isPending}
          error={products.error}
          retry={() => void products.refetch()}
        >
          {product && (
            <DecisionPanel
              application={application}
              product={product}
              onDone={done}
            />
          )}
        </QueryState>
      )}
      {application.financialSnapshot && (
        <Card className="section" title="Финансовый снимок на момент подачи">
          <p>
            Зафиксирован {date(application.financialSnapshot.capturedAt)} ·
            Версия {application.financialSnapshot.company.financialsVersion}
          </p>
          <Descriptions
            items={[
              {
                key: "cash",
                label: "Денежный остаток",
                children: money(
                  application.financialSnapshot.company.cashBalanceRub,
                ),
              },
              {
                key: "debt",
                label: "Платежи по долгам",
                children: money(
                  application.financialSnapshot.company.existingDebtMonthlyRub,
                ),
              },
              {
                key: "product",
                label: "Продукт на момент подачи",
                children: `${application.financialSnapshot.product.name} · ${application.financialSnapshot.product.annualRatePct}%`,
              },
            ]}
          />
          <Table
            size="small"
            rowKey="month"
            pagination={false}
            scroll={{ x: 480 }}
            dataSource={application.financialSnapshot.company.financials}
            columns={[
              { title: "Месяц", dataIndex: "month" },
              { title: "Выручка", dataIndex: "revenueRub", render: money },
              {
                title: "Расходы",
                dataIndex: "operatingExpensesRub",
                render: money,
              },
            ]}
          />
        </Card>
      )}
      <Card title="История заявки" className="section">
        <ApplicationTimeline history={application.history} />
      </Card>
    </>
  );
}
export function ApplicationPage() {
  const { id = "" } = useParams();
  const query = useApplication(id);
  return (
    <QueryState
      loading={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
    >
      {query.data && (
        <ApplicationDetails
          application={query.data}
          refresh={() => void query.refetch()}
        />
      )}
    </QueryState>
  );
}
