import {test,expect} from '@playwright/test';
test('crear mesa se recupera de un 404 vacío sin perder el formulario',async({page})=>{
  await page.route('**/api/configure',r=>r.fulfill({status:404,body:''}));
  await page.goto('/');await page.locator('#home-create').click();await page.locator('#table-name').fill('Mi mesa recuperada');await page.locator('#create-table').click();
  await expect(page.locator('#config-error')).toContainText('desactualizado');await expect(page.locator('#config-error')).not.toContainText('Unexpected end');await expect(page.locator('#table-name')).toHaveValue('Mi mesa recuperada');
  await page.unroute('**/api/configure');await page.locator('#create-table').click();await expect(page.locator('#lobby-name')).toHaveText('Mi mesa recuperada');await expect(page.locator('#config-error')).toBeHidden();
});
