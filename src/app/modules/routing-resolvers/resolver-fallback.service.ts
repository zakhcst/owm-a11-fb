import { Injectable } from '@angular/core';
import { Resolve } from '@angular/router';
import { Observable, of } from 'rxjs';
import { Store } from '@ngxs/store';
import { OwmFallbackDataService } from '../../services/owm-fallback-data.service';
import { IOwmDataModel } from '../../models/owm-data.model';
import { switchMap } from 'rxjs/operators';
import { AppFallbackDataState } from '../../states/app.state';
import { SetFallbackDataState } from '../../states/app.actions';
import { IHistoryLog } from '../../models/history-log.model';

@Injectable({
  providedIn: 'root',
})
export class ResolverFallbackService implements Resolve<any> {
  constructor(private _store: Store, private _owmFallback: OwmFallbackDataService) { }

  resolve(): Observable<string> | Observable<never> | Observable<IHistoryLog> {
    const falbackData = this._store.selectSnapshot(AppFallbackDataState.selectFallbackData);
    if (falbackData) {
      return of(falbackData);
    } else {
      return this._owmFallback.getData().pipe(
        switchMap((data: IOwmDataModel) => this._store.dispatch([new SetFallbackDataState(data)]))
      );
    }
  }
}