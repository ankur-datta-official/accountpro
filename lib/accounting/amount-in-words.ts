const ONES = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
] as const

function convertBelowHundred(value: number) {
  if (value < 20) {
    return ONES[value]
  }

  const tens = Math.floor(value / 10)
  const remainder = value % 10
  return remainder ? `${TENS[tens]} ${ONES[remainder]}` : TENS[tens]
}

function convertBelowThousand(value: number) {
  if (value < 100) {
    return convertBelowHundred(value)
  }

  const hundreds = Math.floor(value / 100)
  const remainder = value % 100
  return remainder
    ? `${ONES[hundreds]} Hundred ${convertBelowHundred(remainder)}`
    : `${ONES[hundreds]} Hundred`
}

function convertInteger(value: number): string {
  if (value === 0) {
    return ONES[0]
  }

  const parts: string[] = []
  let remainder = Math.floor(value)

  const koti = Math.floor(remainder / 10000000)
  if (koti) {
    parts.push(`${convertInteger(koti)} Koti`)
    remainder %= 10000000
  }

  const lakh = Math.floor(remainder / 100000)
  if (lakh) {
    parts.push(`${convertBelowThousand(lakh)} Lakh`)
    remainder %= 100000
  }

  const hazar = Math.floor(remainder / 1000)
  if (hazar) {
    parts.push(`${convertBelowThousand(hazar)} Hazar`)
    remainder %= 1000
  }

  if (remainder) {
    parts.push(convertBelowThousand(remainder))
  }

  return parts.join(" ").trim()
}

export function bangladeshiAmountToWords(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0
  const taka = Math.floor(safeAmount)
  const paisa = Math.round((safeAmount - taka) * 100)

  const takaWords = `${convertInteger(taka)} Taka`

  if (!paisa) {
    return `${takaWords} Only`
  }

  return `${takaWords} and ${convertInteger(paisa)} Paisa Only`
}
