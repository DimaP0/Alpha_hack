import { Form, InputNumber, Select, Slider } from "antd";
import type { FormInstance } from "antd";
import type { ApplicationInput, CreditProduct } from "../api/contract-types";
import { MoneyField, money } from "./common";
export function LoanForm({
  form,
  products,
  initialValues,
  onFinish,
  onChange,
  children,
}: {
  form: FormInstance<ApplicationInput>;
  products: CreditProduct[];
  initialValues: ApplicationInput;
  onFinish: (value: ApplicationInput) => void;
  onChange?: () => void;
  children: React.ReactNode;
}) {
  const selectedId = Form.useWatch("productId", form) as number | undefined;
  const amount = Form.useWatch("requestedAmountRub", form) as
    | number
    | undefined;
  const product =
    products.find((p) => p.id === (selectedId ?? initialValues.productId)) ||
    products[0];
  return (
    <Form<ApplicationInput>
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
      onValuesChange={(changed) => {
        if (changed.productId) {
          const next = products.find((p) => p.id === changed.productId);
          if (next)
            form.setFieldsValue({
              requestedAmountRub: Math.max(
                next.minAmountRub,
                Math.min(
                  form.getFieldValue("requestedAmountRub") as number,
                  next.maxAmountRub,
                ),
              ),
              termMonths: next.allowedTermsMonths.includes(
                form.getFieldValue("termMonths") as number,
              )
                ? (form.getFieldValue("termMonths") as number)
                : next.allowedTermsMonths[0],
            });
        }
        onChange?.();
      }}
    >
      <Form.Item
        name="productId"
        label="Кредитный продукт"
        rules={[{ required: true }]}
      >
        <Select
          options={products.map((p) => ({ value: p.id, label: p.name }))}
        />
      </Form.Item>
      <Form.Item
        name="requestedAmountRub"
        label="Сумма финансирования"
        rules={[
          {
            required: true,
            type: "integer",
            min: product.minAmountRub,
            max: product.maxAmountRub,
            message: `От ${money(product.minAmountRub)} до ${money(product.maxAmountRub)}`,
          },
        ]}
      >
        <MoneyField min={product.minAmountRub} max={product.maxAmountRub} />
      </Form.Item>
      <Slider
        aria-label="Сумма финансирования ползунок"
        min={product.minAmountRub}
        max={product.maxAmountRub}
        step={10000}
        value={amount ?? initialValues.requestedAmountRub}
        onChange={(value) => {
          form.setFieldValue("requestedAmountRub", value);
          onChange?.();
        }}
        tooltip={{ formatter: (v) => money(v || 0) }}
      />
      <div className="range-labels">
        <span>{money(product.minAmountRub)}</span>
        <span>{money(product.maxAmountRub)}</span>
      </div>
      <div className="form-grid">
        <Form.Item name="termMonths" label="Срок" rules={[{ required: true }]}>
          <Select
            options={product.allowedTermsMonths.map((term) => ({
              value: term,
              label: `${term} месяцев`,
            }))}
          />
        </Form.Item>
        <Form.Item name="purpose" label="Цель" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "EQUIPMENT", label: "Оборудование" },
              { value: "WORKING_CAPITAL", label: "Оборотные средства" },
              { value: "EXPANSION", label: "Расширение бизнеса" },
            ]}
          />
        </Form.Item>
      </div>
      <div className="form-grid">
        <Form.Item
          name="projectedRevenueUpliftMonthlyRub"
          label="Ожидаемый рост выручки / мес."
          rules={[
            {
              required: true,
              type: "integer",
              min: 0,
              message: "Введите целое число от 0",
            },
          ]}
        >
          <MoneyField />
        </Form.Item>
        <Form.Item
          name="upliftStartMonth"
          label="Рост с месяца прогноза"
          rules={[
            {
              required: true,
              type: "integer",
              min: 1,
              max: 12,
              message: "От 1 до 12",
            },
          ]}
        >
          <InputNumber
            min={1}
            max={12}
            precision={0}
            style={{ width: "100%" }}
          />
        </Form.Item>
      </div>
      <p className="muted">
        Ставка продукта: {product.annualRatePct}% годовых. Рост выручки — ваша
        сценарная гипотеза, а не обещание результата.
      </p>
      {children}
    </Form>
  );
}
export function initialLoan(product: CreditProduct): ApplicationInput {
  return {
    productId: product.id,
    requestedAmountRub: Math.max(
      product.minAmountRub,
      Math.min(3000000, product.maxAmountRub),
    ),
    termMonths: product.allowedTermsMonths.includes(36)
      ? 36
      : product.allowedTermsMonths[0],
    purpose: "EQUIPMENT",
    projectedRevenueUpliftMonthlyRub: 150000,
    upliftStartMonth: 4,
  };
}
