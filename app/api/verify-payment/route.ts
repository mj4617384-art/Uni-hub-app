import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: NextRequest) {
  const { reference, walletId } = await req.json();

  if (!reference || !walletId) {
    return NextResponse.json({ error: "Missing reference or walletId" }, { status: 400 });
  }

  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    }
  );

  const verifyData = await verifyRes.json();

  if (!verifyData.status || verifyData.data.status !== "success") {
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  const amountInNaira = verifyData.data.amount / 100;

  const { error } = await supabaseAdmin.rpc("add_money", {
    p_wallet_id: walletId,
    p_amount: amountInNaira,
    p_description: "Paystack top-up",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, amount: amountInNaira });
}
