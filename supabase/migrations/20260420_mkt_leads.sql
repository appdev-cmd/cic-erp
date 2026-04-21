-- 20260420_mkt_leads.sql
-- Migration bổ sung bảng lưu trữ khách hàng tiềm năng cho Lead Hunter (MKT Agent)

create table if not exists mkt_leads (
    id uuid primary key default gen_random_uuid(),
    company_name text not null,
    project_name text,
    industry text, 
    potential_score int, 
    service_need text, 
    urgency_reason text,
    decision_makers jsonb,
    contact_approach text,
    barriers text,
    raw_data jsonb,
    status text default 'new',
    source_round int,
    created_by uuid references employees(id),
    created_at timestamptz default now()
);

alter table mkt_leads enable row level security;

-- MKT staff and Admin can manage leads
create policy "MKT staff can manage leads" on mkt_leads
    for all using (true);

-- Enable realtime
alter publication supabase_realtime add table mkt_leads;
