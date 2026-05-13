-- Update singular KPI stats function to be consistent with new schema (TEXT IDs) and include Profit
CREATE OR REPLACE FUNCTION get_kpi_stats(p_entity_id TEXT, p_type TEXT, p_year INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_result JSONB;
  v_year INTEGER;
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  v_start_date := make_date(v_year, 1, 1);
  v_end_date := make_date(v_year, 12, 31);

  IF p_type = 'employee' THEN
    SELECT jsonb_build_object(
      'contractCount', COUNT(*),
      'totalSigning', COALESCE(SUM(value), 0),
      'totalRevenue', COALESCE(SUM(actual_revenue), 0),
      'totalProfit', COALESCE(SUM(value - COALESCE(estimated_cost, 0)), 0)
    ) INTO v_result
    FROM contracts
    WHERE employee_id = p_entity_id -- No cast, compare as TEXT
      AND signed_date BETWEEN v_start_date AND v_end_date;

  ELSIF p_type = 'unit' THEN
    SELECT jsonb_build_object(
      'contractCount', COUNT(*),
      'totalSigning', COALESCE(SUM(value), 0),
      'totalRevenue', COALESCE(SUM(actual_revenue), 0),
      'totalProfit', COALESCE(SUM(value - COALESCE(estimated_cost, 0)), 0)
    ) INTO v_result
    FROM contracts
    WHERE unit_id = p_entity_id 
      AND signed_date BETWEEN v_start_date AND v_end_date;
  
  ELSE
    RAISE EXCEPTION 'Invalid type. Must be employee or unit';
  END IF;

  RETURN v_result;
END;
$$;
