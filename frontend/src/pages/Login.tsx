import { Button, Card, Form, Input, Typography } from "antd";
import { useMutation } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth";
import { DemoBanner, ErrorNotice } from "../components/common";
export function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const login = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      auth.login(email, password),
    onSuccess: (role) =>
      navigate(role === "BANK_OFFICER" ? "/bank" : "/app", { replace: true }),
  });
  if (auth.user)
    return (
      <Navigate
        to={auth.user.role === "BANK_OFFICER" ? "/bank" : "/app"}
        replace
      />
    );
  return (
    <div className="login-page">
      <DemoBanner />
      <div className="login-grid">
        <section className="login-story">
          <div className="eyebrow">ALFA BUSINESS NAVIGATOR</div>
          <h1>
            Следующий шаг
            <br />
            вашего бизнеса.
          </h1>
          <p>
            Проверьте идею на цифрах, сравните сценарии и пройдите путь от
            заявки до решения банка.
          </p>
          <div className="story-chart" aria-hidden="true">
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>
          <span className="story-caption">
            12 месяцев вперёд · 3 сценария · понятные факторы
          </span>
        </section>
        <Card className="login-card">
          <Typography.Title level={2}>Добро пожаловать</Typography.Title>
          <p className="muted">Войдите в демонстрационный кабинет</p>
          <ErrorNotice error={login.error} />
          <Form
            form={form}
            layout="vertical"
            onFinish={(value) => login.mutate(value)}
            initialValues={{ email: "owner@demo.local", password: "Demo123!" }}
          >
            <Form.Item
              name="email"
              label="Электронная почта"
              rules={[
                {
                  required: true,
                  type: "email",
                  message: "Введите корректный email",
                },
              ]}
            >
              <Input autoComplete="username" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Пароль"
              rules={[{ required: true, message: "Введите пароль" }]}
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={login.isPending}
              size="large"
            >
              Войти
            </Button>
          </Form>
          <div className="demo-accounts">
            <strong>Демо-аккаунты</strong>
            <Button
              type="link"
              onClick={() =>
                form.setFieldsValue({
                  email: "owner@demo.local",
                  password: "Demo123!",
                })
              }
            >
              Предприниматель · owner@demo.local
            </Button>
            <Button
              type="link"
              onClick={() =>
                form.setFieldsValue({
                  email: "bank@demo.local",
                  password: "Demo123!",
                })
              }
            >
              Сотрудник банка · bank@demo.local
            </Button>
            <small>Пароль для обоих: Demo123! · Только для демо</small>
          </div>
        </Card>
      </div>
    </div>
  );
}
