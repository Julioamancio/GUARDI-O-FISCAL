/** Validação de CNPJ com dígitos verificadores (aceita com ou sem máscara). */
export function normalizeCnpj(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digit = (base: string): number => {
    let weight = base.length - 7;
    let sum = 0;
    for (const char of base) {
      sum += Number(char) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  return (
    digit(cnpj.slice(0, 12)) === Number(cnpj[12]) &&
    digit(cnpj.slice(0, 13)) === Number(cnpj[13])
  );
}

/** Validação de CPF com dígitos verificadores (aceita com ou sem máscara). */
export function isValidCpf(value: string): boolean {
  const cpf = normalizeCnpj(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (base: string): number => {
    let weight = base.length + 1;
    let sum = 0;
    for (const char of base) {
      sum += Number(char) * weight;
      weight -= 1;
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return digit(cpf.slice(0, 9)) === Number(cpf[9]) && digit(cpf.slice(0, 10)) === Number(cpf[10]);
}

/** CNPJ (14 dígitos) ou CPF (11 dígitos) válido — planilhas reais misturam os dois. */
export function isValidCnpjOrCpf(value: string): boolean {
  return isValidCnpj(value) || isValidCpf(value);
}

export function formatCnpj(value: string): string {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== 14) return value;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
