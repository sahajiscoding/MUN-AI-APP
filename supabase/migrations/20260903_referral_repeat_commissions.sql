-- Referral commission correction: one commission per verified successful payment.
-- A referred customer keeps one first-touch referral row, while later paid
-- payments from that customer may each create a separate commission.
CREATE OR REPLACE FUNCTION public.create_first_referral_commission(
  p_uid uuid,
  p_payment_id uuid,
  p_order_id text
)
RETURNS TABLE (
  created boolean,
  reason text,
  commission_id uuid,
  commission_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_referral public.referrals%rowtype;
  v_payment public.payments%rowtype;
  v_commission_id uuid;
  v_commission_amount numeric;
  v_commission_rate numeric;
BEGIN
  IF p_uid IS NULL OR p_payment_id IS NULL THEN
    RAISE EXCEPTION 'invalid_commission_input';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
    AND uid = p_uid
    AND status = 'paid'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_paid_or_user_mismatch';
  END IF;

  IF p_order_id IS NOT NULL
     AND p_order_id IS DISTINCT FROM v_payment.order_ref
     AND p_order_id IS DISTINCT FROM v_payment.uropay_order_id THEN
    RAISE EXCEPTION 'payment_order_mismatch';
  END IF;

  -- One immutable first-touch attribution row per customer.
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referred_uid = p_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'no_referral'::text, NULL::uuid, NULL::numeric;
    RETURN;
  END IF;

  SELECT commission_rate INTO v_commission_rate
  FROM public.referral_partners
  WHERE id = v_referral.partner_id
    AND status = 'active';

  IF v_commission_rate IS NULL THEN
    RAISE EXCEPTION 'referral_partner_not_active';
  END IF;

  v_commission_amount := ROUND(
    ((v_payment.amount::numeric / 100) * v_commission_rate / 100)::numeric,
    2
  );

  INSERT INTO public.referral_commissions (
    partner_id,
    referral_id,
    payment_id,
    order_id,
    plan_id,
    payment_amount,
    commission_rate,
    commission_amount,
    status
  )
  VALUES (
    v_referral.partner_id,
    v_referral.id,
    v_payment.id,
    COALESCE(p_order_id, v_payment.uropay_order_id, v_payment.order_ref),
    v_payment.plan_id,
    v_payment.amount::numeric / 100,
    v_commission_rate,
    v_commission_amount,
    'unpaid'
  )
  ON CONFLICT (payment_id) DO NOTHING
  RETURNING id INTO v_commission_id;

  IF v_commission_id IS NULL THEN
    RETURN QUERY SELECT false, 'already_processed'::text, NULL::uuid, NULL::numeric;
    RETURN;
  END IF;

  -- Convert the first-touch referral once, but never overwrite its partner.
  UPDATE public.referrals
  SET status = 'converted',
      first_payment_id = COALESCE(first_payment_id, v_payment.id),
      first_order_id = COALESCE(first_order_id, p_order_id, v_payment.uropay_order_id, v_payment.order_ref),
      converted_at = COALESCE(converted_at, NOW()),
      updated_at = NOW()
  WHERE id = v_referral.id
    AND status = 'registered';

  RETURN QUERY SELECT true, 'created'::text, v_commission_id, v_commission_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.create_first_referral_commission(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_first_referral_commission(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
