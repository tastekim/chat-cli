import https from 'https';

export interface LocationInfo {
  country: string;
  countryCode: string;
  source: 'ip' | 'locale';
}

export class LocationDetector {
  private static readonly TIMEOUT_MS = 3000;
  
  /**
   * 사용자의 지역 정보를 감지합니다.
   * IP 기반 감지를 우선 시도하고, 실패 시 로케일 기반으로 fallback합니다.
   */
  static async detectLocation(): Promise<LocationInfo> {
    try {
      // 1차: IP 기반 감지 (더 정확)
      const ipLocation = await this.getLocationFromIP();
      return {
        country: ipLocation.country,
        countryCode: ipLocation.country_code,
        source: 'ip'
      };
    } catch (error) {
      // 2차: 로케일 기반 감지 (오프라인 가능)
      return this.getLocationFromLocale();
    }
  }

  /**
   * IP 기반으로 지역 정보를 가져옵니다.
   */
  private static async getLocationFromIP(): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = https.get('https://ipapi.co/json/', {
        timeout: this.TIMEOUT_MS,
        headers: {
          'User-Agent': 'chat-cli-location-detector'
        }
      }, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const locationData = JSON.parse(data);
            if (locationData.country_code && locationData.country_name) {
              resolve({
                country: locationData.country_name,
                country_code: locationData.country_code
              });
            } else {
              reject(new Error('Invalid response format'));
            }
          } catch (error) {
            reject(new Error('Failed to parse location response'));
          }
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * 시스템 로케일 기반으로 지역 정보를 가져옵니다.
   */
  private static getLocationFromLocale(): LocationInfo {
    try {
      // Intl API를 사용한 로케일 감지
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      const intlLocale = new Intl.Locale(locale);
      
      if (intlLocale.region) {
        return {
          country: this.getCountryNameFromCode(intlLocale.region),
          countryCode: intlLocale.region,
          source: 'locale'
        };
      }
    } catch (error) {
      // Intl API 실패 시 환경변수 사용
    }

    // 환경변수에서 로케일 추출
    const envLocale = process.env.LANG || process.env.LC_ALL || 'en_US.UTF-8';
    const countryCode = envLocale.split('_')[1]?.split('.')[0] || 'US';
    
    return {
      country: this.getCountryNameFromCode(countryCode),
      countryCode,
      source: 'locale'
    };
  }

  /**
   * 국가 코드를 국가명으로 변환합니다.
   */
  private static getCountryNameFromCode(countryCode: string): string {
    const countryMap: Record<string, string> = {
      'US': 'United States',
      'KR': 'South Korea',
      'JP': 'Japan',
      'CN': 'China',
      'GB': 'United Kingdom',
      'DE': 'Germany',
      'FR': 'France',
      'CA': 'Canada',
      'AU': 'Australia',
      'IN': 'India',
      'BR': 'Brazil',
      'RU': 'Russia',
      'IT': 'Italy',
      'ES': 'Spain',
      'NL': 'Netherlands',
      'SE': 'Sweden',
      'NO': 'Norway',
      'DK': 'Denmark',
      'FI': 'Finland',
      'PL': 'Poland',
      'CZ': 'Czech Republic',
      'AT': 'Austria',
      'CH': 'Switzerland',
      'BE': 'Belgium',
      'PT': 'Portugal',
      'IE': 'Ireland',
      'IL': 'Israel',
      'TR': 'Turkey',
      'ZA': 'South Africa',
      'EG': 'Egypt',
      'NG': 'Nigeria',
      'KE': 'Kenya',
      'MA': 'Morocco',
      'TH': 'Thailand',
      'VN': 'Vietnam',
      'SG': 'Singapore',
      'MY': 'Malaysia',
      'ID': 'Indonesia',
      'PH': 'Philippines',
      'TW': 'Taiwan',
      'HK': 'Hong Kong',
      'MX': 'Mexico',
      'AR': 'Argentina',
      'CL': 'Chile',
      'CO': 'Colombia',
      'PE': 'Peru',
      'VE': 'Venezuela'
    };

    return countryMap[countryCode.toUpperCase()] || countryCode;
  }

  /**
   * 국가 코드를 이모지 플래그로 변환합니다.
   */
  static getCountryFlag(countryCode: string): string {
    if (!countryCode || countryCode.length !== 2) return '🌍';
    
    const codePoints = countryCode.toUpperCase().split('').map(char => 
      127397 + char.charCodeAt(0)
    );
    
    return String.fromCodePoint(...codePoints);
  }

  /**
   * 지역 정보를 읽기 쉬운 형태로 포맷합니다.
   */
  static formatLocation(locationInfo: LocationInfo): string {
    const flag = this.getCountryFlag(locationInfo.countryCode);
    return `${flag}${locationInfo.countryCode}`;
  }
}