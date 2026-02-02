interface CookieJson {
  domain: string;
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite: string;
  secure: boolean;
  session: boolean;
  storeId: string;
  value: string;
}

interface ParsedCookieResult {
  cookieString: string;
  expirationDate: Date | null;
  isExpired: boolean;
  expiresIn: string | null;
}

export function parseJsonCookies(jsonInput: string): ParsedCookieResult {
  let cookies: CookieJson[];
  
  try {
    cookies = JSON.parse(jsonInput);
  } catch (e) {
    if (jsonInput.includes('=') && (jsonInput.includes(';') || !jsonInput.includes('{'))) {
      return {
        cookieString: jsonInput.trim(),
        expirationDate: null,
        isExpired: false,
        expiresIn: null,
      };
    }
    throw new Error('Invalid cookie format. Please provide a valid JSON array or cookie string.');
  }
  
  if (!Array.isArray(cookies)) {
    throw new Error('Cookie input must be a JSON array of cookie objects.');
  }
  
  const cookieParts: string[] = [];
  let earliestExpiration: number | null = null;
  
  for (const cookie of cookies) {
    if (!cookie.name || cookie.value === undefined) {
      continue;
    }
    
    cookieParts.push(`${cookie.name}=${cookie.value}`);
    
    if (cookie.expirationDate && !cookie.session) {
      if (earliestExpiration === null || cookie.expirationDate < earliestExpiration) {
        earliestExpiration = cookie.expirationDate;
      }
    }
  }
  
  if (cookieParts.length === 0) {
    throw new Error('No valid cookies found in the input.');
  }
  
  const cookieString = cookieParts.join('; ');
  
  let expirationDate: Date | null = null;
  let isExpired = false;
  let expiresIn: string | null = null;
  
  if (earliestExpiration !== null) {
    expirationDate = new Date(earliestExpiration * 1000);
    const now = new Date();
    isExpired = expirationDate < now;
    
    if (!isExpired) {
      const diffMs = expirationDate.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (diffDays > 0) {
        expiresIn = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        expiresIn = `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
      } else {
        expiresIn = 'Less than 1 hour';
      }
    }
  }
  
  return {
    cookieString,
    expirationDate,
    isExpired,
    expiresIn,
  };
}

export function getWhiskCookieStatus(jsonCookie: string | null): {
  isValid: boolean;
  isExpired: boolean;
  expirationDate: string | null;
  expiresIn: string | null;
  error: string | null;
} {
  if (!jsonCookie) {
    return {
      isValid: false,
      isExpired: false,
      expirationDate: null,
      expiresIn: null,
      error: 'No cookie configured',
    };
  }
  
  try {
    const parsed = parseJsonCookies(jsonCookie);
    
    return {
      isValid: true,
      isExpired: parsed.isExpired,
      expirationDate: parsed.expirationDate?.toISOString() || null,
      expiresIn: parsed.expiresIn,
      error: parsed.isExpired ? 'Cookie has expired. Please update with fresh cookies.' : null,
    };
  } catch (e) {
    return {
      isValid: false,
      isExpired: false,
      expirationDate: null,
      expiresIn: null,
      error: e instanceof Error ? e.message : 'Invalid cookie format',
    };
  }
}

export function getCookieStringFromJson(jsonCookie: string): string {
  const parsed = parseJsonCookies(jsonCookie);
  return parsed.cookieString;
}
