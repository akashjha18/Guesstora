const sdkLoads = new Map();

export function loadPaymentSdk({ globalName, src }) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (sdkLoads.has(globalName)) return sdkLoads.get(globalName);

  const sdkLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      if (window[globalName]) resolve(window[globalName]);
      else reject(new Error(`${globalName} SDK did not initialize.`));
    };
    script.onerror = () => reject(new Error(`Unable to load ${globalName} SDK.`));
    document.head.appendChild(script);
  }).catch(error => {
    sdkLoads.delete(globalName);
    throw error;
  });

  sdkLoads.set(globalName, sdkLoad);
  return sdkLoad;
}
