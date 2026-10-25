INSERT INTO companies(id,inn,name,operating_months,cash_balance_rub,existing_debt_monthly_rub,late_payments_last12m,tax_debt_rub,is_active,financials_version) VALUES
(1,'7700000001','ООО «ТехноСтрой»',48,1800000,120000,0,0,true,1),
(2,'7700000002','ООО «Демо Сервис»',36,1200000,80000,0,0,true,1);
INSERT INTO credit_products(id,name,annual_rate_pct,min_amount_rub,max_amount_rub,allowed_terms_months) VALUES
(1,'Кредит на развитие',20,100000,10000000,'12,24,36,48,60'),
(2,'Пополнение оборотных средств',22,100000,5000000,'12,24,36');
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2025-10',1900000,1300000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2025-11',2000000,1400000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2025-12',2100000,1450000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2026-01',2200000,1500000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2026-02',1900000,1300000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2026-03',2000000,1400000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2026-04',2100000,1450000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2026-05',2200000,1500000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2026-06',1900000,1300000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2026-07',2000000,1400000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2026-08',2100000,1450000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (1,'2026-09',2200000,1500000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2025-10',1900000,1300000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2025-11',2000000,1400000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2025-12',2100000,1450000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2026-01',2200000,1500000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2026-02',1900000,1300000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2026-03',2000000,1400000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2026-04',2100000,1450000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2026-05',2200000,1500000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2026-06',1900000,1300000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2026-07',2000000,1400000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2026-08',2100000,1450000);
INSERT INTO monthly_financials(company_id,month,revenue_rub,operating_expenses_rub) VALUES (2,'2026-09',2200000,1500000);
ALTER TABLE companies ALTER COLUMN id RESTART WITH 3;
ALTER TABLE credit_products ALTER COLUMN id RESTART WITH 3;
