import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SharedModule } from '../../modules/shared.module';
import { StatsComponent } from './stats.component';
import { ResolverStatsService } from '../../modules/routing-resolvers/resolver-stats.service';
import { ResolverHistoryLogService } from '../../modules/routing-resolvers/resolver-history-log.service';

const componentRoutes: Routes = [
  {
    path: '',
    component: StatsComponent,
    resolve: {
      initStatsService: ResolverStatsService,
      initHistoryLog: ResolverHistoryLogService,
    }
  }
];

@NgModule({
  declarations: [StatsComponent],
  imports: [
    RouterModule.forChild(componentRoutes),
    SharedModule,
  ],
  exports: [RouterModule]
})
export class StatsModule { }
