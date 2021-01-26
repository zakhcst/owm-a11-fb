import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';

import { Observable, Subscription, fromEvent, BehaviorSubject } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';

import { Select, Store } from '@ngxs/store';
import { AppErrorPayloadModel } from '../../states/app.models';
import { ITimeTemplate } from '../../models/hours.model';

import { ConstantsService } from '../../services/constants.service';
import { ErrorsService } from '../../services/errors.service';
import { IOwmDataModel } from '../../models/owm-data.model';
import { AppOwmDataState, AppStatusState } from '../../states/app.state';
import { PopulateGchartDataService } from 'src/app/services/populate-gchart-data.service';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { ChartReadyEvent } from 'angular-google-charts';

@Component({
  selector: 'app-forecast-gchart',
  templateUrl: './forecast-gchart.component.html',
  styleUrls: ['./forecast-gchart.component.css'],
})
export class ForecastGChartComponent implements OnInit, OnDestroy {
  @ViewChild('dateColumn', { static: true })
  dateColumn: ElementRef;

  timeTemplate: ITimeTemplate[] = ConstantsService.timeTemplate;
  loadingOwmData = true;
  weatherData: IOwmDataModel;
  chart: {} = {};
  activeDays: string[] = [];
  weatherDataDateKeys: string[];
  resizeObservable$: Observable<Event>;
  orientationchangeObservable$: Observable<Event>;
  layoutChangesOrientation$: Observable<BreakpointState>;
  subscriptions: Subscription;
  daysForecast = this._store.selectSnapshot(AppStatusState.daysForecast);
  containerPadding = 20;
  cardPadding = 10;
  dateColumnWidth = 40;
  overlaySubjecs = [];

  @Select(AppOwmDataState.selectOwmData) owmData$: Observable<IOwmDataModel>;
  @Select(AppStatusState.daysForecast) daysForecast$: Observable<number>;
  @Select(AppStatusState.showChartIcons) showChartIcons$: Observable<boolean>;

  constructor(
    private _errors: ErrorsService,
    private _populateGchartData: PopulateGchartDataService,
    private _breakpointObserver: BreakpointObserver,
    private _store: Store
  ) {}

  ngOnInit() {
    this.resizeObservable$ = fromEvent(window, 'resize');
    this.subscriptions = this.resizeObservable$.subscribe(() => {
      if (this.activeDays.length > 0) {
        this.resizeGraphs(this.activeDays);
      }
    });

    const layoutChangesOrientation$ = this._breakpointObserver.observe([
      '(orientation: portrait)',
      '(orientation: landscape)',
    ]);
    const layoutChangesOrientationSubscription = layoutChangesOrientation$.subscribe((result) => {
      if (this.activeDays.length > 0) {
        this.resizeGraphs(this.activeDays);
      }
    });
    this.subscriptions.add(layoutChangesOrientationSubscription);

    const daysForecastSubscription = this.daysForecast$.subscribe((daysForecast) => {
      this.daysForecast = daysForecast;
      if (this.activeDays.length > 0) {
        this.resizeGraphs(this.activeDays);
      }
    });
    this.subscriptions.add(daysForecastSubscription);

    // helper BehaviorSubjects array for each chart to debouce and delay icons redraws
    [...Array(6)].forEach(() => {
      const behaviorSubject = new BehaviorSubject(null);
      const overlaySubscription = behaviorSubject
        .pipe(
          filter((data) => !!data),
          debounceTime(1000)
        )
        .subscribe((data) => {
          this.redrawOverlay(data);
        });
      this.overlaySubjecs.push(behaviorSubject);
      this.subscriptions.add(overlaySubscription);
    });

    this.onChange();
  }

  ngOnDestroy() {
    if (this.subscriptions) {
      this.subscriptions.unsubscribe();
    }
  }

  onChange() {
    this.loadingOwmData = true;
    const weatherDataSubscription = this.owmData$.pipe(filter((data) => !!data)).subscribe(
      (data) => {
        this.weatherData = data;
        this.activeDays = Object.keys(this.weatherData.listByDate).sort();
        this.weatherDataDateKeys = [...this.activeDays];
        this.loadingOwmData = false;
        this.chart = this._populateGchartData.setGChartData(this.weatherData.listByDate, this.weatherDataDateKeys);
        this.resizeGraphs(this.activeDays);
      },
      (err) => {
        this.loadingOwmData = false;
        this.addError('ngOnInit: onChange: subscribe', err.message);
      }
    );
    this.subscriptions.add(weatherDataSubscription);
  }

  clickedDay(selectedDay: string) {
    const activeDaysLength = this.activeDays.length;
    this.activeDays = [];
    const activeDays = activeDaysLength === 1 ? [...this.weatherDataDateKeys] : [selectedDay];
    this.resizeGraphs(activeDays);
    this.activeDays = activeDays;
  }

  resizeGraphs(activeDays: string[]) {
    const dateColumn = this.dateColumn.nativeElement;
    const documentBodyWidth = document.body.clientWidth;
    if (dateColumn) {
      const activeDaysLength = activeDays.length;
      const activeDaysHeightCoef = activeDaysLength === 1 ? 1 : 0.94;
      const days = activeDaysLength === 1 ? 1 : this.daysForecast;
      const dateColumnClientHeight = dateColumn.clientHeight || window.innerHeight - 100;
      const graphHeight = Math.floor((dateColumnClientHeight * activeDaysHeightCoef) / days);
      const graphWidth = Math.floor(
        documentBodyWidth - this.containerPadding - this.cardPadding - this.dateColumnWidth
      );

      activeDays.forEach((dayK) => {
        this.chart[dayK].height = graphHeight;
        this.chart[dayK].width = graphWidth;
      });
    }
  }

  setIconStyle(slot) {
    const iconSize = ConstantsService.iconsWeatherSize2;
    const iconStyle = {
      'background-position':
        '0 ' + (slot.iconIndex ? '-' : '') + (slot.iconIndex === undefined ? 1 : slot.iconIndex) * iconSize + 'px',
    };
    return iconStyle;
  }

  onReady($event: ChartReadyEvent, gc, overlay, overlayContent, ind) {
    if (!gc || !overlay || !overlayContent) return;
    overlayContent.setAttribute('style', 'display: none;');
    const extendedIndex = this.activeDays.length === 1 ? 5 : ind;
    const params = { gc, overlay, overlayContent, extendedIndex };
    this.overlaySubjecs[extendedIndex].next(params);
    // on debounce crashes use:
    // this.redrawOverlay({ gc, overlay, overlayContent, extendedIndex });
  }

  redrawOverlay({ gc, overlay, overlayContent, extendedIndex }) {
    const scaleFactor = 0.87;
    const cli = gc.chart.getChartLayoutInterface();
    const overlayTop = gc.height / 2 - 10;
    setTimeout(() => {
      overlay.setAttribute('style', `top: ${overlayTop}px;`);
      let chartArea;
      try {
        chartArea = cli.getChartAreaBoundingBox();
      } catch {
        console.log('Chart Refresh Error', extendedIndex, gc);
        chartArea = { left: gc.width * 0.65, width: gc.width * 0.75};
      }
      const offsetLeft = chartArea.left + (chartArea.width * (1 - scaleFactor)) / 2;
      const overlayContentWidth = chartArea.width * scaleFactor;
      overlayContent.setAttribute(
        'style',
        `left: ${offsetLeft}px; 
        width: ${overlayContentWidth}px; 
        display: flex;
        `
      );
    }, 500);
  }

  addError(custom: string, errorMessage: string) {
    const errorLog: AppErrorPayloadModel = {
      userMessage: 'Connection or service problem. Please reload or try later.',
      logMessage: `ForecastGChartComponent: ${custom}: ${errorMessage}`,
    };
    this._errors.add(errorLog);
  }
}
