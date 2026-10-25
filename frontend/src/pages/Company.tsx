import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Space,
  Table,
} from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../api/hooks";
import { http } from "../api/http";
import type { Company, FinancialsUpdateRequest } from "../api/contract-types";
import {
  ErrorNotice,
  MoneyField,
  PageTitle,
  QueryState,
} from "../components/common";
export function validateFinancials(
  value: FinancialsUpdateRequest,
): string | null {
  if (
    !Number.isSafeInteger(value.cashBalanceRub) ||
    value.cashBalanceRub < 0 ||
    !Number.isSafeInteger(value.existingDebtMonthlyRub) ||
    value.existingDebtMonthlyRub < 0
  )
    return "Суммы должны быть целыми неотрицательными числами";
  if (value.financials?.length !== 12) return "Нужно ровно 12 месяцев";
  const months: number[] = [];
  for (const row of value.financials) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month))
      return "Используйте формат месяца ГГГГ-ММ";
    if (
      ![row.revenueRub, row.operatingExpensesRub].every(
        (v) => Number.isSafeInteger(v) && v >= 0,
      )
    )
      return "Выручка и расходы должны быть целыми неотрицательными числами";
    const [year, month] = row.month.split("-").map(Number);
    months.push(year * 12 + month);
  }
  months.sort((a, b) => a - b);
  return months.some((v, i) => i > 0 && v !== months[i - 1] + 1)
    ? "Месяцы должны быть уникальными и последовательными"
    : null;
}
export function FinancialHistoryEditor({ company }: { company: Company }) {
  const client = useQueryClient();
  const [form] = Form.useForm<FinancialsUpdateRequest>();
  const save = useMutation({
    mutationFn: async (value: FinancialsUpdateRequest) => {
      const error = validateFinancials(value);
      if (error) throw new Error(error);
      return http<Company>("/companies/me/financials", {
        method: "PUT",
        body: value,
      });
    },
    onSuccess: (updated) => {
      client.setQueryData(["company"], updated);
      client.removeQueries({ queryKey: ["simulation"] });
    },
  });
  return (
    <Card title="Финансовая история · 12 месяцев">
      <p className="muted">
        Изменения повлияют на новые расчёты. Сохранённые снимки ранее поданных
        заявок останутся неизменными.
      </p>
      <ErrorNotice error={save.error} />
      {save.isSuccess && (
        <Alert
          className="notice"
          type="success"
          showIcon
          message="Финансовые данные сохранены"
        />
      )}
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          cashBalanceRub: company.cashBalanceRub,
          existingDebtMonthlyRub: company.existingDebtMonthlyRub,
          financials: company.financials,
        }}
        onFinish={(value) => save.mutate(value)}
      >
        <div className="form-grid">
          <Form.Item
            name="cashBalanceRub"
            label="Денежный остаток"
            rules={[{ required: true, message: "Введите остаток" }]}
          >
            <MoneyField />
          </Form.Item>
          <Form.Item
            name="existingDebtMonthlyRub"
            label="Текущие ежемесячные платежи по долгам"
            rules={[{ required: true, message: "Введите платёж" }]}
          >
            <MoneyField />
          </Form.Item>
        </div>
        <div className="financial-table">
          <Table
            pagination={false}
            rowKey="month"
            dataSource={company.financials}
            size="small"
            columns={[
              {
                title: "Месяц",
                width: 155,
                render: (_, _row, i) => (
                  <Form.Item
                    name={["financials", i, "month"]}
                    rules={[{ required: true, message: "Укажите месяц" }]}
                  >
                    <Input aria-label={`Месяц ${i + 1}`} />
                  </Form.Item>
                ),
              },
              {
                title: "Выручка, ₽",
                render: (_, _row, i) => (
                  <Form.Item
                    name={["financials", i, "revenueRub"]}
                    rules={[{ required: true, message: "Введите выручку" }]}
                  >
                    <MoneyField aria-label={`Выручка ${i + 1}`} />
                  </Form.Item>
                ),
              },
              {
                title: "Операционные расходы, ₽",
                render: (_, _row, i) => (
                  <Form.Item
                    name={["financials", i, "operatingExpensesRub"]}
                    rules={[{ required: true, message: "Введите расходы" }]}
                  >
                    <MoneyField aria-label={`Расходы ${i + 1}`} />
                  </Form.Item>
                ),
              },
            ]}
          />
        </div>
        <Space className="section">
          <Button type="primary" htmlType="submit" loading={save.isPending}>
            Сохранить финансовые данные
          </Button>
          <Button
            onClick={() => {
              form.resetFields();
              save.reset();
            }}
          >
            Сбросить изменения
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
export function CompanyPage() {
  const query = useCompany();
  return (
    <>
      <PageTitle eyebrow="МОЙ БИЗНЕС" title="Финансы компании">
        Актуальные данные — основа осмысленного прогноза.
      </PageTitle>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {query.data && (
          <>
            <Card className="section-bottom">
              <Descriptions
                title={query.data.name}
                items={[
                  {
                    key: "inn",
                    label: "Синтетический ИНН",
                    children: query.data.inn,
                  },
                  {
                    key: "age",
                    label: "Срок работы",
                    children: `${query.data.operatingMonths} мес.`,
                  },
                  {
                    key: "version",
                    label: "Версия финансов",
                    children: query.data.financialsVersion,
                  },
                ]}
              />
            </Card>
            <FinancialHistoryEditor
              key={query.data.financialsVersion}
              company={query.data}
            />
          </>
        )}
      </QueryState>
    </>
  );
}
